// ============================================================
// 🦀 Krab — Tool Registry
// ============================================================
import type { ToolDefinition, ToolResult } from "../core/types.js";
import { logger } from "../utils/logger.js";

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    logger.debug(`[Registry] Registered tool: ${tool.name}`);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getReadOnly(): ToolDefinition[] {
    return this.getAll().filter((t) => !t.sideEffect);
  }

  getMutating(): ToolDefinition[] {
    return this.getAll().filter((t) => t.sideEffect);
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolDescriptions(): string {
    return this.getAll()
      .map(
        (t) =>
          `- **${t.name}**: ${t.description}${t.requireApproval ? " ⚠️ (requires approval)" : ""}`,
      )
      .join("\n");
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return { success: false, output: "", error: `Tool "${name}" not found` };
    }

    try {
      const result = await tool.execute(args);
      return result;
    } catch (error: any) {
      logger.error(`[Registry] Tool execution error for '${name}':`, error);
      return { success: false, output: "", error: error.message };
    }
  }
}

export const registry = new ToolRegistry();

// ── Tool Factory ────────────────────────────────────────────
export function tool(def: ToolDefinition): ToolDefinition {
  return def;
}
