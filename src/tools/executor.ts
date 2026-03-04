// ============================================================
// 🦀 Krab — Tool Executor (Hybrid: Parallel/Sequential)
// ============================================================
import { registry } from "./registry.js";
import { logger } from "../utils/logger.js";
import type { ToolResult } from "../core/types.js";
import pc from "picocolors";
import * as readline from "node:readline/promises";

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

  // Approval check for side-effect tools
  if (tool.requireApproval) {
    const approved = await askApproval(name, args);
    if (!approved) {
      return { success: false, output: "", error: "User denied execution" };
    }
  }

  try {
    logger.debug(`[Executor] Running tool: ${name}`);
    const result = await tool.execute(parsed.data);
    return result;
  } catch (err: any) {
    logger.error(`[Executor] Tool "${name}" failed: ${err.message}`);
    return { success: false, output: "", error: err.message };
  }
}

// ── Execute tool calls (hybrid strategy) ───────────────────
export async function executeToolCalls(
  toolCalls: { name: string; args: Record<string, unknown> }[],
): Promise<{ name: string; result: ToolResult }[]> {
  const results: { name: string; result: ToolResult }[] = [];

  // Separate read-only (parallel) from side-effect (sequential)
  const readOnly = toolCalls.filter((tc) => {
    const tool = registry.get(tc.name);
    return tool && !tool.sideEffect;
  });

  const mutating = toolCalls.filter((tc) => {
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
        result: await executeSingle(tc.name, tc.args),
      })),
    );
    results.push(...parallelResults);
  }

  // Execute mutating tools sequentially
  for (const tc of mutating) {
    logger.debug(`[Executor] Running mutating tool: ${tc.name} (sequential)`);
    const result = await executeSingle(tc.name, tc.args);
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
