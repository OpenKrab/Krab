// ============================================================
// 🦀 Krab — Sub-Agent Tool (Hierarchical Planning)
// ============================================================
import { z } from "zod";
import { ToolDefinition, ToolResult } from "../../core/types.js";
import { Agent } from "../../core/agent.js";
import { loadConfig } from "../../core/config.js";
import { logger } from "../../utils/logger.js";
import pc from "picocolors";

export const subAgentTool: ToolDefinition = {
  name: "spawn_sub_agent",
  description:
    "Delegates a specific sub-task to a specialized sub-agent. Useful for hierarchical planning and complex tasks.",
  parameters: z.object({
    task: z
      .string()
      .describe("The specific sub-task or question for the sub-agent"),
    profile: z
      .string()
      .optional()
      .describe("The profile of the sub-agent (e.g., 'coder', 'researcher')"),
    context: z
      .string()
      .optional()
      .describe("Optional context to provide to the sub-agent"),
  }),
  execute: async ({ task, profile, context }): Promise<ToolResult> => {
    try {
      logger.info(
        `[SubAgent] Spawning worker for: ${pc.bold(task.slice(0, 50))}...`,
      );

      const config = loadConfig();
      // Apply profile overrides if exists
      let agentConfig = config;
      if (profile && config.agents?.list?.[profile]) {
        const override = config.agents.list[profile];
        agentConfig = {
          ...config,
          agents: {
            ...config.agents!,
            defaults: {
              ...config.agents!.defaults,
              model: override.model || config.agents!.defaults.model,
            },
          },
        };
      }

      const worker = new Agent(agentConfig);

      // Build full task with context
      const fullTask = context ? `Context: ${context}\n\nTask: ${task}` : task;

      const startTime = Date.now();
      const result = await worker.chat(fullTask, {
        conversationId: `sub_${Date.now()}`,
      });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      logger.info(`[SubAgent] Worker completed in ${elapsed}s`);

      return {
        success: true,
        output: result,
      };
    } catch (error: any) {
      logger.error(`[SubAgent] Failed to spawn sub-agent: ${error.message}`);
      return {
        success: false,
        output: "",
        error: error.message,
      };
    }
  },
};
