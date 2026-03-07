// ============================================================
// 🦀 Krab — Inbound Debounce (Duplicate Prevention)
// ============================================================
import { logger } from "../utils/logger.js";

export interface InboundMessage {
  id: string;
  channelId: string;
  senderId: string;
  contentHash: string;
  timestamp: Date;
  processed: boolean;
}

export interface DebounceConfig {
  windowMs: number;
  maxMessages: number;
  hashContent: boolean;
}

export class InboundDebounce {
  private recentMessages = new Map<string, InboundMessage[]>();
  private config: DebounceConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<DebounceConfig> = {}) {
    this.config = {
      windowMs: config.windowMs || 5000,
      maxMessages: config.maxMessages || 10,
      hashContent: config.hashContent ?? true,
    };
    this.startCleanup();
  }

  isDuplicate(
    messageId: string,
    channelId: string,
    senderId: string,
    content?: string
  ): boolean {
    const key = this.getKey(channelId, senderId);
    const messages = this.recentMessages.get(key) || [];
    const now = new Date();

    const recentWithinWindow = messages.filter(
      (m) => now.getTime() - m.timestamp.getTime() < this.config.windowMs
    );

    if (recentWithinWindow.length >= this.config.maxMessages) {
      logger.warn(
        `[InboundDebounce] Rate limit exceeded for ${channelId}:${senderId}`
      );
      return true;
    }

    const isDuplicate = recentWithinWindow.some((m) => m.id === messageId);

    if (!isDuplicate && content) {
      const contentHash = this.hashContent(content);
      const contentDuplicate = recentWithinWindow.some(
        (m) => m.contentHash === contentHash
      );
      if (contentDuplicate) {
        logger.debug(`[InboundDebounce] Duplicate content detected`);
        return true;
      }
    }

    if (!isDuplicate) {
      const message: InboundMessage = {
        id: messageId,
        channelId,
        senderId,
        contentHash: content ? this.hashContent(content) : "",
        timestamp: now,
        processed: false,
      };
      recentWithinWindow.push(message);
      this.recentMessages.set(key, recentWithinWindow);
    }

    return isDuplicate;
  }

  markProcessed(messageId: string, channelId: string, senderId: string): void {
    const key = this.getKey(channelId, senderId);
    const messages = this.recentMessages.get(key);
    
    if (messages) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.processed = true;
      }
    }
  }

  getPendingCount(channelId: string, senderId: string): number {
    const key = this.getKey(channelId, senderId);
    const messages = this.recentMessages.get(key) || [];
    return messages.filter((m) => !m.processed).length;
  }

  private getKey(channelId: string, senderId: string): string {
    return `${channelId}:${senderId}`;
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.windowMs);
  }

  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, messages] of this.recentMessages) {
      const valid = messages.filter(
        (m) => now.getTime() - m.timestamp.getTime() < this.config.windowMs * 2
      );
      
      if (valid.length === 0) {
        this.recentMessages.delete(key);
      } else {
        this.recentMessages.set(key, valid);
      }
      cleaned += messages.length - valid.length;
    }

    if (cleaned > 0) {
      logger.debug(`[InboundDebounce] Cleaned up ${cleaned} old entries`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.recentMessages.clear();
  }
}
