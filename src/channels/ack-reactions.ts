// ============================================================
// 🦀 Krab — Ack Reactions (Delivery Status)
// ============================================================
import { logger } from "../utils/logger.js";

export type AckStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface AckReaction {
  messageId: string;
  status: AckStatus;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AckConfig {
  enableReactions: boolean;
  reactionMapping: Record<AckStatus, string>;
  timeoutMs: number;
  retryCount: number;
}

export const DEFAULT_ACK_CONFIG: AckConfig = {
  enableReactions: true,
  reactionMapping: {
    pending: "⏳",
    sent: "✅",
    delivered: "📤",
    read: "👁️",
    failed: "❌",
  },
  timeoutMs: 30000,
  retryCount: 3,
};

export class AckReactions {
  private acknowledgements = new Map<string, AckReaction>();
  private pending = new Map<string, {
    resolve: (ack: AckReaction) => void;
    reject: (error: Error) => void;
    attempts: number;
  }>();
  private config: AckConfig;
  private channel: any;

  constructor(channel: any, config: Partial<AckConfig> = {}) {
    this.channel = channel;
    this.config = { ...DEFAULT_ACK_CONFIG, ...config };
  }

  async sendWithAck(
    messageId: string,
    content: string,
    recipient: string
  ): Promise<AckReaction> {
    const ack: AckReaction = {
      messageId,
      status: "pending",
      timestamp: new Date(),
    };

    this.acknowledgements.set(messageId, ack);
    this.sendReaction(messageId, "pending");

    return new Promise((resolve, reject) => {
      this.pending.set(messageId, {
        resolve,
        reject,
        attempts: 0,
      });

      setTimeout(() => {
        this.handleAckTimeout(messageId);
      }, this.config.timeoutMs);
    });
  }

  private handleAckTimeout(messageId: string): void {
    const pending = this.pending.get(messageId);
    if (!pending) return;

    pending.attempts++;

    if (pending.attempts >= this.config.retryCount) {
      const ack = this.getAck(messageId);
      if (ack) {
        ack.status = "failed";
        ack.error = "Acknowledgement timeout";
      }
      pending.reject(new Error("Acknowledgement timeout"));
      this.pending.delete(messageId);
      this.sendReaction(messageId, "failed");
    } else {
      logger.debug(`[AckReactions] Retry ${pending.attempts}/${this.config.retryCount} for ${messageId}`);
    }
  }

  markSent(messageId: string): void {
    this.updateAck(messageId, "sent");
    this.sendReaction(messageId, "sent");
  }

  markDelivered(messageId: string): void {
    this.updateAck(messageId, "delivered");
    this.sendReaction(messageId, "delivered");
  }

  markRead(messageId: string): void {
    this.updateAck(messageId, "read");
    this.sendReaction(messageId, "read");
  }

  markFailed(messageId: string, error?: string): void {
    this.updateAck(messageId, "failed", error);
    this.sendReaction(messageId, "failed");
  }

  getAck(messageId: string): AckReaction | undefined {
    return this.acknowledgements.get(messageId);
  }

  getAllAcks(): AckReaction[] {
    return Array.from(this.acknowledgements.values());
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  private updateAck(messageId: string, status: AckStatus, error?: string): void {
    const ack = this.acknowledgements.get(messageId);
    if (!ack) return;

    ack.status = status;
    ack.timestamp = new Date();
    if (error) ack.error = error;

    const pending = this.pending.get(messageId);
    if (pending) {
      pending.resolve(ack);
      this.pending.delete(messageId);
    }

    logger.debug(`[AckReactions] ${messageId} -> ${status}`);
  }

  private sendReaction(messageId: string, status: AckStatus): void {
    if (!this.config.enableReactions) return;

    const emoji = this.config.reactionMapping[status];
    if (!emoji) return;

    try {
      if (typeof this.channel.addReaction === "function") {
        this.channel.addReaction(messageId, emoji, "");
      }
    } catch (error) {
      logger.warn(`[AckReactions] Failed to send reaction:`, error);
    }
  }

  clear(): void {
    this.acknowledgements.clear();
    this.pending.clear();
  }

  getStatusCounts(): Record<AckStatus, number> {
    const counts: Record<AckStatus, number> = {
      pending: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    for (const ack of this.acknowledgements.values()) {
      counts[ack.status]++;
    }

    return counts;
  }
}
