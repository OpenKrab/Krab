import type { KrabConfig, ToolDefinition } from "../core/types.js";
import { hooksManager } from "../hooks/index.js";

export interface ToolPolicyContext {
  config?: KrabConfig;
  toolName: string;
  providerName?: string;
  agentId?: string;
}

export interface ToolPolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  mutationCategory: ToolDefinition["mutationCategory"];
}

export interface ToolPolicyHookPayload {
  toolName: string;
  providerName?: string;
  agentId?: string;
  mutationCategory: ToolDefinition["mutationCategory"];
  decision?: ToolPolicyDecision;
}

function matchesPolicyList(toolName: string, values?: string[]): boolean {
  if (!values || values.length === 0) {
    return false;
  }
  return values.includes(toolName) || values.includes("*");
}

function mergePolicyLists(primary?: string[], secondary?: string[]): string[] | undefined {
  const merged = [...(primary || []), ...(secondary || [])];
  return merged.length > 0 ? Array.from(new Set(merged)) : undefined;
}

export async function fireToolPolicyHook(
  type: "tool:policy:pre" | "tool:policy:post",
  payload: ToolPolicyHookPayload,
): Promise<void> {
  await hooksManager.fireEvent({
    type,
    data: payload,
    timestamp: new Date(),
    sessionId: payload.agentId,
  });
}

export async function evaluateToolPolicy(
  tool: ToolDefinition,
  context: ToolPolicyContext,
): Promise<ToolPolicyDecision> {
  const toolsConfig = context.config?.tools;
  const agentPolicy = context.agentId
    ? context.config?.agents?.list?.find((agent) => agent.id === context.agentId)?.tools
    : undefined;
  const providerPolicy = context.providerName
    ? toolsConfig?.byProvider?.[context.providerName]
    : undefined;
  const allow = mergePolicyLists(mergePolicyLists(toolsConfig?.allow, providerPolicy?.allow), agentPolicy?.allow);
  const deny = mergePolicyLists(mergePolicyLists(toolsConfig?.deny, providerPolicy?.deny), agentPolicy?.deny);
  const mutationCategory = tool.mutationCategory || (tool.sideEffect ? "write" : "read");

  if (matchesPolicyList(tool.name, deny)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Tool '${tool.name}' denied by policy`,
      mutationCategory,
    };
  }

  if (allow && allow.length > 0 && !matchesPolicyList(tool.name, allow)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Tool '${tool.name}' not included in allowlist`,
      mutationCategory,
    };
  }

  return {
    allowed: true,
    requiresApproval: !!tool.requireApproval,
    mutationCategory,
  };
}
