// ============================================================
// 🦀 Krab — Multi-Agent Router
// ============================================================
import { KrabConfig, AgentBinding, AgentOverride } from "../core/types.js";
import { BaseMessage } from "../channels/base.js";
import { logger } from "../utils/logger.js";

export interface RouteResolution {
  agentId: string;
  reason: string;
}

export class AgentRouter {
  private config: KrabConfig;

  constructor(config: KrabConfig) {
    this.config = config;
  }

  /**
   * Route a message to the appropriate agent
   */
  routeMessage(message: BaseMessage, channelName: string, accountId?: string): string {
    return this.routeMessageDetailed(message, channelName, accountId).agentId;
  }

  routeMessageDetailed(message: BaseMessage, channelName: string, accountId?: string): RouteResolution {
    const bindings = this.config.agents?.bindings || [];

    // Sort bindings by priority (higher priority first)
    const sortedBindings = bindings.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const binding of sortedBindings) {
      if (this.matchesBinding(message, channelName, accountId, binding)) {
        logger.debug(`[AgentRouter] Routed message to agent: ${binding.agentId}`);
        return {
          agentId: binding.agentId,
          reason: this.describeBinding(binding),
        };
      }
    }

    // Fallback to default agent
    const defaultAgent = this.getDefaultAgent();
    logger.debug(`[AgentRouter] No binding matched, using default agent: ${defaultAgent}`);
    return {
      agentId: defaultAgent,
      reason: "default-agent-fallback",
    };
  }

  /**
   * Check if a message matches a binding rule
   */
  private matchesBinding(
    message: BaseMessage,
    channelName: string,
    accountId: string | undefined,
    binding: AgentBinding
  ): boolean {
    const match = binding.match;

    // 1. peer match (exact DM/group/channel id)
    if (match.peer) {
      const isDM = !message.metadata?.groupId;
      const expectedKind = match.peer.kind;
      const expectedId = match.peer.id;

      if ((expectedKind === "direct" && isDM) || (expectedKind === "group" && !isDM)) {
        if (!expectedId || expectedId === message.sender.id || expectedId === message.metadata?.groupId) {
          return this.checkChannelAndAccount(channelName, accountId, match);
        }
      }
      return false;
    }

    // 2. parentPeer match (thread inheritance) - simplified for now
    // TODO: Implement thread inheritance

    // 3. guildId + roles (Discord role routing)
    if (match.guildId && match.roles) {
      // TODO: Implement Discord role checking
      // For now, check guildId only
      if (message.metadata?.guildId === match.guildId) {
        return this.checkChannelAndAccount(channelName, accountId, match);
      }
      return false;
    }

    // 4. guildId (Discord)
    if (match.guildId) {
      if (message.metadata?.guildId === match.guildId) {
        return this.checkChannelAndAccount(channelName, accountId, match);
      }
      return false;
    }

    // 5. teamId (Slack) - not implemented yet

    // 6. accountId match for a channel
    if (match.accountId && match.accountId !== "*") {
      if (accountId === match.accountId) {
        return this.checkChannel(channelName, match);
      }
      return false;
    }

    // 7. channel-level match (accountId: "*")
    if (match.accountId === "*" && match.channel) {
      return channelName === match.channel;
    }

    // 8. channel-only match (no accountId specified)
    if (match.channel && !match.accountId) {
      return channelName === match.channel;
    }

    return false;
  }

  private checkChannelAndAccount(channelName: string, accountId: string | undefined, match: AgentBinding['match']): boolean {
    if (match.channel && channelName !== match.channel) {
      return false;
    }

    if (match.accountId && match.accountId !== "*" && accountId !== match.accountId) {
      return false;
    }

    return true;
  }

  private checkChannel(channelName: string, match: AgentBinding['match']): boolean {
    return !match.channel || channelName === match.channel;
  }

  private describeBinding(binding: AgentBinding): string {
    const parts: string[] = [];
    if (binding.match.channel) {
      parts.push(`channel=${binding.match.channel}`);
    }
    if (binding.match.accountId) {
      parts.push(`accountId=${binding.match.accountId}`);
    }
    if (binding.match.peer?.kind) {
      parts.push(`peer=${binding.match.peer.kind}${binding.match.peer.id ? `:${binding.match.peer.id}` : ""}`);
    }
    if (binding.match.guildId) {
      parts.push(`guildId=${binding.match.guildId}`);
    }
    return parts.length > 0 ? `binding-match(${parts.join(",")})` : `binding-match(${binding.agentId})`;
  }

  /**
   * Get the default agent ID
   */
  private getDefaultAgent(): string {
    const agents = this.config.agents?.list || [];

    // First, check for explicitly marked default
    const defaultAgent = agents.find(agent => agent.default);
    if (defaultAgent) {
      return defaultAgent.id;
    }

    // Fallback to first agent
    if (agents.length > 0) {
      return agents[0].id;
    }

    // Ultimate fallback
    return "main";
  }

  /**
   * Get agent configuration by ID
   */
  getAgentConfig(agentId: string): AgentOverride | null {
    const agents = this.config.agents?.list || [];
    return agents.find(agent => agent.id === agentId) || null;
  }

  /**
   * Get all agent configurations
   */
  getAllAgents(): AgentOverride[] {
    return this.config.agents?.list || [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: KrabConfig): void {
    this.config = config;
  }
}

// Export singleton instance
export const agentRouter = new AgentRouter({} as KrabConfig);
