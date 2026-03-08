// ============================================================
// 🦀 Krab — Tool Executor (Hybrid: Parallel/Sequential)
// ============================================================
import { registry } from "./registry.js";
import { loadConfig } from "../core/config.js";
import { logger } from "../utils/logger.js";
import type { ToolResult } from "../core/types.js";
import { recordToolExecutionDiagnostic } from "./diagnostics.js";
import { evaluateToolPolicy, fireToolPolicyHook } from "./policy.js";
import { sessionStore } from "../session/store.js";
import pc from "picocolors";
import * as readline from "node:readline/promises";

const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 12000;

function classifyToolMutation(tool: { sideEffect?: boolean; mutationCategory?: string }): string {
  if (tool.mutationCategory) {
    return tool.mutationCategory;
  }
  return tool.sideEffect ? "write" : "read";
}

function guardToolResult(tool: { maxOutputChars?: number }, result: ToolResult): ToolResult {
  const maxChars = tool.maxOutputChars || DEFAULT_MAX_TOOL_OUTPUT_CHARS;
  if (typeof result.output === "string" && result.output.length > maxChars) {
    return {
      ...result,
      output: result.output.slice(0, maxChars) + "\n...[truncated]",
    };
  }
  return result;
}

// ── Ask user for approval ──────────────────────────────────
async function askApproval(
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const argsStr = JSON.stringify(args, null, 2);

  console.log(pc.yellow(`\n⚠️  Tool "${toolName}" requires approval:`));
  console.log(pc.dim(argsStr));

  const answer = await rl.question(pc.yellow("Allow execution? (y/N): "));
  rl.close();
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

// ── Execute a single tool ──────────────────────────────────
async function executeSingle(
  name: string,
  args: Record<string, unknown>,
  context?: { agentId?: string },
): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { success: false, output: "", error: `Tool "${name}" not found` };
  }

  // Validate args with Zod
  const parsed = tool.parameters.safeParse(args);
  if (!parsed.success) {
    const errMsg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    return { success: false, output: "", error: `Invalid args: ${errMsg}` };
  }

  const config = loadConfig();
  const resolvedAgentId = context?.agentId ? (sessionStore.getAgentId(context.agentId) || context.agentId) : undefined;
  await fireToolPolicyHook("tool:policy:pre", {
    toolName: name,
    providerName: config.provider?.name,
    agentId: resolvedAgentId,
    mutationCategory: classifyToolMutation(tool) as any,
  });
  const policy = await evaluateToolPolicy(tool, {
    config,
    toolName: name,
    providerName: config.provider?.name,
    agentId: resolvedAgentId,
  });
  await fireToolPolicyHook("tool:policy:post", {
    toolName: name,
    providerName: config.provider?.name,
    agentId: resolvedAgentId,
    mutationCategory: policy.mutationCategory,
    decision: policy,
  });
  recordToolExecutionDiagnostic({
    timestamp: new Date().toISOString(),
    toolName: name,
    success: policy.allowed,
    durationMs: 0,
    sideEffect: classifyToolMutation(tool) !== "read",
    phase: "policy",
    decision: policy.allowed ? (policy.requiresApproval ? "approval_required" : "allowed") : "denied",
    reason: policy.reason,
    error: policy.allowed ? undefined : policy.reason,
  });
  if (!policy.allowed) {
    return { success: false, output: "", error: policy.reason || `Tool '${name}' denied by policy` };
  }

  // Approval check for side-effect tools
  if (policy.requiresApproval) {
    const approved = await askApproval(name, args);
    recordToolExecutionDiagnostic({
      timestamp: new Date().toISOString(),
      toolName: name,
      success: approved,
      durationMs: 0,
      sideEffect: classifyToolMutation(tool) !== "read",
      phase: "policy",
      decision: approved ? "approved" : "rejected",
      error: approved ? undefined : "User denied execution",
    });
    if (!approved) {
      return { success: false, output: "", error: "User denied execution" };
    }
  }

  try {
    logger.debug(`[Executor] Running tool: ${name}`);
    const startedAt = Date.now();
    const rawResult = await tool.execute(parsed.data);
    const result = guardToolResult(tool, rawResult);
    recordToolExecutionDiagnostic({
      timestamp: new Date().toISOString(),
      toolName: name,
      success: result.success,
      durationMs: Date.now() - startedAt,
      sideEffect: classifyToolMutation(tool) !== "read",
      error: result.error,
      phase: "execution",
    });
    return result;
  } catch (err: any) {
    logger.error(`[Executor] Tool "${name}" failed: ${err.message}`);
    recordToolExecutionDiagnostic({
      timestamp: new Date().toISOString(),
      toolName: name,
      success: false,
      durationMs: 0,
      sideEffect: classifyToolMutation(tool) !== "read",
      error: err.message,
      phase: "execution",
    });
    return { success: false, output: "", error: err.message };
  }
}

// ── Execute tool calls (hybrid strategy) ───────────────────
export async function executeToolCalls(
  toolCalls: { name: string; args: Record<string, unknown> }[],
  context?: { agentId?: string },
): Promise<{ name: string; result: ToolResult }[]> {
  const results: { name: string; result: ToolResult }[] = [];

  const seenCallKeys = new Set<string>();
  const dedupedToolCalls = toolCalls.filter((tc) => {
    const callKey = `${tc.name}:${JSON.stringify(tc.args)}`;
    if (seenCallKeys.has(callKey)) {
      logger.warn(`[Executor] Skipping duplicate tool call in batch: ${tc.name}`);
      return false;
    }
    seenCallKeys.add(callKey);
    return true;
  });

  // Separate read-only (parallel) from side-effect (sequential)
  const readOnly = dedupedToolCalls.filter((tc) => {
    const tool = registry.get(tc.name);
    return tool && !tool.sideEffect;
  });

  const mutating = dedupedToolCalls.filter((tc) => {
    const tool = registry.get(tc.name);
    return !tool || tool.sideEffect;
  });

  // Execute read-only tools in parallel
  if (readOnly.length > 0) {
    logger.debug(
      `[Executor] Running ${readOnly.length} read-only tool(s) in parallel`,
    );
    const parallelResults = await Promise.all(
      readOnly.map(async (tc) => ({
        name: tc.name,
        result: await executeSingle(tc.name, tc.args, context),
      })),
    );
    results.push(...parallelResults);
  }

  // Execute mutating tools sequentially
  for (const tc of mutating) {
    logger.debug(`[Executor] Running mutating tool: ${tc.name} (sequential)`);
    const result = await executeSingle(tc.name, tc.args, context);
    results.push({ name: tc.name, result });

    // Stop if a mutating tool fails
    if (!result.success) {
      logger.warn(
        `[Executor] Stopping sequential execution due to failure in ${tc.name}`,
      );
      break;
    }
  }

  return results;
}
