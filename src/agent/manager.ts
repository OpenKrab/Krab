// ============================================================
// 🦀 Krab — Agent Manager (Multi-Agent Support)
// ============================================================
import { KrabConfig, AgentOverride } from "../core/types.js";
import { Agent } from "../core/agent.js";
import { AgentRouter } from "./router.js";
import { BaseMessage } from "../channels/base.js";
import { logger } from "../utils/logger.js";

export class AgentManager {
  private config: KrabConfig;
  private router: AgentRouter;
  private agents: Map<string, Agent> = new Map();

  constructor(config: KrabConfig) {
    this.config = config;
    this.router = new AgentRouter(config);
    this.initializeAgents();
  }

  /**
   * Initialize all configured agents
   */
  private initializeAgents(): void {
    const agentList = this.config.agents?.list || [];

    // If no agents configured, create a default "main" agent
    if (agentList.length === 0) {
      const defaultConfig = { ...this.config };
      if (!defaultConfig.agents) {
        defaultConfig.agents = { defaults: this.config.agents?.defaults || {} as any };
      }
      this.agents.set("main", new Agent(defaultConfig));
      return;
    }

    // Initialize configured agents
    for (const agentConfig of agentList) {
      const agentId = agentConfig.id;

      // Create agent-specific config
      const agentSpecificConfig = this.createAgentConfig(agentConfig);

      this.agents.set(agentId, new Agent(agentSpecificConfig));
      logger.info(`[AgentManager] Initialized agent: ${agentId}`);
    }
  }

  /**
   * Create agent-specific configuration
   */
  private createAgentConfig(agentOverride: AgentOverride): KrabConfig {
    const baseConfig = { ...this.config };

    // Override agent-specific settings
    if (agentOverride.workspace) {
      if (!baseConfig.agents) baseConfig.agents = { defaults: {} as any };
      baseConfig.agents.defaults.workspace = agentOverride.workspace;
    }

    if (agentOverride.model) {
      if (!baseConfig.agents) baseConfig.agents = { defaults: {} as any };
      if (!baseConfig.agents.defaults.model) baseConfig.agents.defaults.model = { primary: "" };
      baseConfig.agents.defaults.model.primary = agentOverride.model.primary;
      if (agentOverride.model.fallbacks) {
        baseConfig.agents.defaults.model.fallbacks = agentOverride.model.fallbacks;
      }
    }

    // Override tools if specified
    if (agentOverride.tools) {
      if (!baseConfig.tools) baseConfig.tools = {} as any;
      if (agentOverride.tools.profile) {
        baseConfig.tools.profile = agentOverride.tools.profile as any;
      }
      if (agentOverride.tools.allow) {
        baseConfig.tools.allow = agentOverride.tools.allow;
      }
      if (agentOverride.tools.deny) {
        baseConfig.tools.deny = agentOverride.tools.deny;
      }
    }

    return baseConfig;
  }

  /**
   * Route a message to the appropriate agent and get response
   */
  async routeAndRespond(
    message: BaseMessage,
    channelName: string,
    accountId?: string
  ): Promise<string> {
    const agentId = this.router.routeMessage(message, channelName, accountId);
    const agent = this.agents.get(agentId);

    if (!agent) {
      logger.error(`[AgentManager] No agent found for ID: ${agentId}`);
      return "❌ Agent not found";
    }

    // Convert BaseMessage to string input for agent
    const input = this.buildAgentInput(message);

    return await agent.chat(input);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Map<string, Agent> {
    return this.agents;
  }

  /**
   * Add a new agent dynamically
   */
  addAgent(agentId: string, agentConfig: AgentOverride): void {
    const agentSpecificConfig = this.createAgentConfig(agentConfig);
    this.agents.set(agentId, new Agent(agentSpecificConfig));
    logger.info(`[AgentManager] Added agent: ${agentId}`);
  }

  /**
   * Remove an agent
   */
  removeAgent(agentId: string): boolean {
    const removed = this.agents.delete(agentId);
    if (removed) {
      logger.info(`[AgentManager] Removed agent: ${agentId}`);
    }
    return removed;
  }

  /**
   * Update configuration and reinitialize agents
   */
  updateConfig(config: KrabConfig): void {
    this.config = config;
    this.router.updateConfig(config);
    // Reinitialize agents with new config
    this.agents.clear();
    this.initializeAgents();
  }

  /**
   * Build agent input from message
   */
  private buildAgentInput(message: BaseMessage): string {
    let input = message.content;

    // Add metadata context
    if (message.metadata?.replyTo) {
      input = `[Replying to: ${message.metadata.replyTo}] ${input}`;
    }

    if (message.metadata?.groupId) {
      input = `[Group: ${message.metadata.groupId}] ${input}`;
    }

    return input;
  }
}

// Export singleton instance
let agentManager: AgentManager | null = null;

export function getAgentManager(config?: KrabConfig): AgentManager {
  if (!agentManager) {
    if (!config) {
      throw new Error("AgentManager not initialized and no config provided");
    }
    agentManager = new AgentManager(config);
  }
  return agentManager;
}

export function initializeAgentManager(config: KrabConfig): void {
  agentManager = new AgentManager(config);
}
