import { Agent } from "../core/agent.js";
import { type KrabConfig } from "../core/types.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

export interface SubAgentContext {
  id: string;
  role: string;
  goal: string;
  parentConversationId: string;
  memory: string[];
  status: "idle" | "running" | "completed" | "failed";
}

/**
 * SuperAgent is the "Main" agent (Supervisor) that can spawn SubAgents.
 * Hierarchical Planning: It delegates tasks to specific roles.
 */
export class SuperAgent extends Agent {
  private subAgents = new Map<
    string,
    { agent: Agent; context: SubAgentContext }
  >();

  constructor(config: KrabConfig) {
    super(config);
    this.registerSubAgentTools();
  }

  /**
   * Spawns a new SubAgent with a specific role and goal.
   */
  public spawnSubAgent(
    role: string,
    goal: string,
    parentConversationId: string,
  ): string {
    const id = `subagent-${crypto.randomBytes(4).toString("hex")}`;

    // Create a new strict config for the subagent
    const subConfig: KrabConfig = {
      ...this.getConfig(),
      maxIterations: 10, // Subagents get their own iteration limit
      // Provide a specialized system prompt for the role
      agents: {
        ...this.getConfig().agents,
        defaults: {
          ...this.getConfig().agents?.defaults,
          model: (() => {
            const m =
              this.getConfig().agents?.defaults?.model ||
              this.getConfig().provider?.model ||
              "gemini-2.0-flash";
            return typeof m === "string" ? { primary: m } : m;
          })(),
          workspace:
            this.getConfig().agents?.defaults?.workspace || "~/.krab/workspace",
        },
      },
    };

    const subAgent = new Agent(subConfig);

    this.subAgents.set(id, {
      agent: subAgent,
      context: {
        id,
        role,
        goal,
        parentConversationId,
        memory: [],
        status: "idle",
      },
    });

    logger.info(`[SuperAgent] Spawned SubAgent ${id} for role: ${role}`);
    return id;
  }

  /**
   * Executes a task using a specific SubAgent.
   */
  public async executeSubAgentTask(id: string, task: string): Promise<string> {
    const sub = this.subAgents.get(id);
    if (!sub) {
      throw new Error(`SubAgent ${id} not found.`);
    }

    sub.context.status = "running";
    logger.info(`[SuperAgent] Delegating task to SubAgent ${id}: ${task}`);

    // Give the subagent its context
    const prompt = `[Goal: ${sub.context.goal}]\n\n[Task]: ${task}`;

    try {
      // Use conversationId = id to keep memory isolated but trackable
      const response = await sub.agent.chatWithMemory(prompt, {
        conversationId: id,
        useMemory: true,
      });

      sub.context.status = "completed";
      sub.context.memory.push(`Task: ${task}\nResult: ${response}`);
      return response;
    } catch (error: any) {
      sub.context.status = "failed";
      logger.error(`[SuperAgent] SubAgent ${id} failed: ${error.message}`);
      return `❌ SubAgent failed: ${error.message}`;
    }
  }

  public getSubAgentStatus(id: string): SubAgentContext | undefined {
    return this.subAgents.get(id)?.context;
  }

  public killSubAgent(id: string): boolean {
    logger.info(`[SuperAgent] Terminating SubAgent ${id}`);
    return this.subAgents.delete(id);
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
