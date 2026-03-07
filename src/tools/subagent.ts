import { type ToolDefinition } from "../core/types.js";
import { SuperAgent } from "../agents/super-agent.js";
import { z } from "zod";

interface RuntimeDeps {
  agent: any;
}

export function createSubAgentTools(superAgent: SuperAgent): ToolDefinition[] {
  return [
    {
      name: "spawn_subagent",
      description:
        "Spawn a specialized sub-agent for a specific role or goal. Useful for parallel or complex hierarchical tasks.",
      parameters: z.object({
        role: z
          .string()
          .describe(
            "The specific role of the agent (e.g., 'Researcher', 'Coder')",
          ),
        goal: z.string().describe("The ultimate goal of this sub-agent"),
        parentConversationId: z
          .string()
          .describe("The conversation ID of the parent delegating the task"),
      }),
      execute: async (args: {
        role: string;
        goal: string;
        parentConversationId: string;
      }) => {
        try {
          const id = superAgent.spawnSubAgent(
            args.role,
            args.goal,
            args.parentConversationId,
          );
          return {
            success: true,
            output: `Spawned sub-agent ID: ${id}. Ready to receive tasks.`,
          };
        } catch (e: any) {
          return { success: false, output: "", error: e.message };
        }
      },
    },
    {
      name: "delegate_task",
      description:
        "Delegate a specific task to an existing sub-agent and wait for the result.",
      parameters: z.object({
        subagentId: z.string().describe("The ID of the spawned sub-agent"),
        task: z.string().describe("The task to execute"),
      }),
      execute: async (args: { subagentId: string; task: string }) => {
        try {
          const result = await superAgent.executeSubAgentTask(
            args.subagentId,
            args.task,
          );
          return {
            success: true,
            output: result,
          };
        } catch (e: any) {
          return { success: false, output: "", error: e.message };
        }
      },
    },
    {
      name: "kill_subagent",
      description: "Terminate a sub-agent once its job is completely done.",
      parameters: z.object({
        subagentId: z.string().describe("The ID of the sub-agent to kill"),
      }),
      execute: async (args: { subagentId: string }) => {
        try {
          superAgent.killSubAgent(args.subagentId);
          return {
            success: true,
            output: `SubAgent ${args.subagentId} terminated successfully.`,
          };
        } catch (e: any) {
          return { success: false, output: "", error: e.message };
        }
      },
    },
  ];
}
