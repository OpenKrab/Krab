import { Agent } from "../core/agent.js";
import { type KrabConfig } from "../core/types.js";
import { logger } from "../utils/logger.js";
import { getSubagentRuntime, type SubagentStatus } from "../agent/subagent-runtime.js";

export interface SubAgentContext {
  id: string;
  role: string;
  goal: string;
  parentConversationId: string;
  memory: string[];
  status: SubagentStatus;
}

/**
 * SuperAgent is the "Main" agent (Supervisor) that can spawn SubAgents.
 * Hierarchical Planning: It delegates tasks to specific roles.
 */
export class SuperAgent extends Agent {
  constructor(config: KrabConfig) {
    super(config);
    this.registerSubAgentTools();
    getSubagentRuntime(config);
  }

  /**
   * Spawns a new SubAgent with a specific role and goal.
   */
  public spawnSubAgent(
    role: string,
    goal: string,
    parentConversationId: string,
  ): string {
    const runtime = getSubagentRuntime(this.getConfig());
    const record = runtime.spawn(role, goal, parentConversationId, {
      channel: "super-agent",
      mode: "main",
      senderId: "super-agent",
    });

    logger.info(`[SuperAgent] Spawned SubAgent ${record.id} for role: ${role}`);
    return record.id;
  }

  /**
   * Executes a task using a specific SubAgent.
   */
  public async executeSubAgentTask(id: string, task: string): Promise<string> {
    const runtime = getSubagentRuntime(this.getConfig());
    const sub = runtime.get(id);
    if (!sub) {
      throw new Error(`SubAgent ${id} not found.`);
    }

    logger.info(`[SuperAgent] Delegating task to SubAgent ${id}: ${task}`);

    try {
      const result = await runtime.execute(id, task);
      return result.lastResult || "";
    } catch (error: any) {
      logger.error(`[SuperAgent] SubAgent ${id} failed: ${error.message}`);
      return `❌ SubAgent failed: ${error.message}`;
    }
  }

  public getSubAgentStatus(id: string): SubAgentContext | undefined {
    const runtime = getSubagentRuntime(this.getConfig());
    const record = runtime.get(id);
    if (!record) {
      return undefined;
    }
    return {
      id: record.id,
      role: record.role,
      goal: record.goal,
      parentConversationId: record.parentConversationId,
      memory: record.lastResult ? [`Task: ${record.lastTask || ""}\nResult: ${record.lastResult}`] : [],
      status: record.status,
    };
  }

  public killSubAgent(id: string): boolean {
    logger.info(`[SuperAgent] Terminating SubAgent ${id}`);
    return getSubagentRuntime(this.getConfig()).kill(id);
  }

  /**
   * Registers tools inside the main Agent's tool registry so the LLM can use them.
   * (Ideally this would be injected into the registry, doing it conceptually here).
   */
  private registerSubAgentTools() {
    // NOTE: We should map these to actual tools in the registry.ts
    // This just documents the schema for the prompt.
    const toolsDocs = [
      {
        name: "spawn_subagent",
        description:
          "Spawns a specialized worker agent. Provide 'role' and 'goal'. Returns a subagent_id.",
      },
      {
        name: "delegate_task",
        description:
          "Delegate a task to an existing subagent. Provide 'subagent_id' and 'task'. Returns result.",
      },
      {
        name: "kill_subagent",
        description: "Terminate a subagent. Provide 'subagent_id'.",
      },
    ];
  }
}
