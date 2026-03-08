import { z } from "zod";
import { tool } from "../registry.js";
import { Agent } from "../../core/agent.js";
import { loadConfig } from "../../core/config.js";

const acpSpawnSchema = z.object({
  task: z.string().describe("The task for the child agent to perform"),
  agentId: z.string().optional().describe("Specific agent to spawn (uses default if not specified)"),
  mode: z.enum(["run", "session"]).optional().describe("Spawn mode: 'run' for oneshot, 'session' for persistent"),
  label: z.string().optional().describe("Label for the spawned session"),
});

export const acpSpawnTool = tool({
  name: "acp_spawn",
  description: "Spawn a child agent to handle a specific task. The child agent runs independently and can communicate back to the parent.",
  parameters: acpSpawnSchema,
  execute: async ({ task, agentId, mode = "run", label }) => {
    try {
      // Use current config for consistency
      const config = loadConfig();
      const childAgent = new Agent(config);

      // Generate child session ID
      const childSessionId = `acp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Execute the task with the child agent
      const response = await childAgent.chat(task, {
        conversationId: childSessionId,
      });

      // In full ACP, this would handle streaming back to parent, session management, etc.
      // For now, just return the result
      return {
        success: true,
        output: `ACP child agent spawned successfully. Session: ${childSessionId}\nResponse: ${response}`,
        childSessionId,
        mode,
        label,
      };
    } catch (error) {
      return {
        success: false,
        error: `ACP spawn failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
