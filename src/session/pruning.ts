// ============================================================
// 🦀 Krab — Session Pruning (Tool Result Trimming)
// ============================================================
import { logger } from "../utils/logger.js";
import type { Message } from "../core/types.js";

export interface PruningConfig {
  enabled: boolean;
  mode: "cache-ttl";
  ttl: string; // e.g., "5m"
  keepLastAssistants: number;
  contextWindowEstimation: number;
}

export interface PruningResult {
  messages: Message[];
  prunedCount: number;
  totalTokens: number;
  estimatedTokens: number;
}

export class SessionPruner {
  private config: PruningConfig;
  private lastPruneTime: Map<string, number> = new Map(); // sessionKey -> timestamp

  constructor(config: PruningConfig) {
    this.config = config;
  }

  /**
   * Prune messages for a session if needed
   */
  pruneMessages(sessionKey: string, messages: Message[], currentTime: number = Date.now()): PruningResult {
    if (!this.config.enabled) {
      return {
        messages,
        prunedCount: 0,
        totalTokens: this.estimateTokens(messages),
        estimatedTokens: this.estimateTokens(messages)
      };
    }

    const lastPrune = this.lastPruneTime.get(sessionKey) || 0;
    const ttlMs = this.parseDuration(this.config.ttl);

    // Only prune if TTL has expired
    if (currentTime - lastPrune < ttlMs) {
      return {
        messages,
        prunedCount: 0,
        totalTokens: this.estimateTokens(messages),
        estimatedTokens: this.estimateTokens(messages)
      };
    }

    logger.debug(`[SessionPruner] Pruning session ${sessionKey} (TTL expired)`);

    const pruned = this.performPruning(messages);
    this.lastPruneTime.set(sessionKey, currentTime);

    return {
      messages: pruned.messages,
      prunedCount: pruned.prunedCount,
      totalTokens: this.estimateTokens(messages),
      estimatedTokens: this.estimateTokens(pruned.messages)
    };
  }

  /**
   * Perform the actual pruning logic
   */
  private performPruning(messages: Message[]): { messages: Message[]; prunedCount: number } {
    const keepLastAssistants = this.config.keepLastAssistants;

    // Find the cutoff point: keep last N assistant messages
    const assistantIndices: number[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        assistantIndices.unshift(i);
        if (assistantIndices.length >= keepLastAssistants) {
          break;
        }
      }
    }

    if (assistantIndices.length < keepLastAssistants) {
      // Not enough assistant messages to establish cutoff, skip pruning
      return { messages, prunedCount: 0 };
    }

    const cutoffIndex = assistantIndices[assistantIndices.length - 1];
    const protectedRange = cutoffIndex;

    // Collect tool results to potentially prune (before the protected range)
    const toolResultsToCheck: { index: number; message: Message }[] = [];
    for (let i = 0; i < protectedRange; i++) {
      if (messages[i].role === "tool") {
        toolResultsToCheck.push({ index: i, message: messages[i] });
      }
    }

    // Filter out tool results with images (never prune these)
    const prunableToolResults = toolResultsToCheck.filter(({ message }) => {
      // Check if message contains image content
      const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
      return !content.includes("image") && !content.includes("png") && !content.includes("jpg") && !content.includes("jpeg");
    });

    // For now, prune all prunable tool results (soft pruning)
    // In a more sophisticated implementation, we could do hard pruning or selective pruning
    const indicesToRemove = prunableToolResults.map(tr => tr.index).sort((a, b) => b - a); // Sort descending

    let prunedMessages = [...messages];
    let prunedCount = 0;

    for (const index of indicesToRemove) {
      prunedMessages.splice(index, 1);
      prunedCount++;
    }

    logger.debug(`[SessionPruner] Pruned ${prunedCount} tool results`);

    return {
      messages: prunedMessages,
      prunedCount
    };
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  private estimateTokens(messages: Message[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
      // Rough estimate: ~4 characters per token
      totalTokens += Math.ceil(content.length / 4);
    }

    return totalTokens;
  }

  /**
   * Parse duration string to milliseconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit as keyof typeof multipliers] || multipliers.m);
  }

  /**
   * Update pruning configuration
   */
  updateConfig(config: Partial<PruningConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export convenience functions
export function createSessionPruner(config: PruningConfig): SessionPruner {
  return new SessionPruner(config);
}

export function shouldPruneSession(config: PruningConfig, sessionKey: string, lastActivity: number, currentTime: number = Date.now()): boolean {
  if (!config.enabled) return false;

  const ttlMs = parseDurationForPruning(config.ttl);
  return currentTime - lastActivity >= ttlMs;
}

function parseDurationForPruning(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 5 * 60 * 1000; // Default 5 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * (multipliers[unit as keyof typeof multipliers] || multipliers.m);
}
