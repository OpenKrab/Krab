// ============================================================
// 🦀 Krab — Typing Indicators & Status
// ============================================================
import { logger } from "../utils/logger.js";

export type TypingStatus = "typing" | "recording" | "paused" | "stopped";

export interface TypingState {
  channelId: string;
  userId: string;
  status: TypingStatus;
  startedAt: Date;
  expiresAt: Date;
}

export class TypingIndicator {
  private typingStates = new Map<string, TypingState>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private defaultTimeoutMs = 10000;

  constructor(private channelName: string) {
    this.startCleanup();
  }

  start(userId: string, channelId: string, customTimeout?: number): TypingState {
    const now = new Date();
    const timeout = customTimeout || this.defaultTimeoutMs;
    
    const state: TypingState = {
      channelId,
      userId,
      status: "typing",
      startedAt: now,
      expiresAt: new Date(now.getTime() + timeout),
    };

    const key = this.getKey(channelId, userId);
    this.typingStates.set(key, state);
    
    logger.debug(`[TypingIndicator.${this.channelName}] Started: ${userId} in ${channelId}`);
    
    return state;
  }

  stop(userId: string, channelId: string): boolean {
    const key = this.getKey(channelId, userId);
    const state = this.typingStates.get(key);
    
    if (state) {
      state.status = "stopped";
      state.expiresAt = new Date();
      this.typingStates.delete(key);
      logger.debug(`[TypingIndicator.${this.channelName}] Stopped: ${userId} in ${channelId}`);
      return true;
    }
    
    return false;
  }

  pause(userId: string, channelId: string): boolean {
    const key = this.getKey(channelId, userId);
    const state = this.typingStates.get(key);
    
    if (state && state.status === "typing") {
      state.status = "paused";
      return true;
    }
    
    return false;
  }

  resume(userId: string, channelId: string): boolean {
    const key = this.getKey(channelId, userId);
    const state = this.typingStates.get(key);
    
    if (state && state.status === "paused") {
      state.status = "typing";
      state.expiresAt = new Date(Date.now() + this.defaultTimeoutMs);
      return true;
    }
    
    return false;
  }

  getState(userId: string, channelId: string): TypingState | undefined {
    return this.typingStates.get(this.getKey(channelId, userId));
  }

  getActiveStates(channelId?: string): TypingState[] {
    const now = new Date();
    const states: TypingState[] = [];
    
    for (const state of this.typingStates.values()) {
      if (channelId && state.channelId !== channelId) continue;
      if (state.expiresAt < now) continue;
      states.push(state);
    }
    
    return states;
  }

  isTyping(userId: string, channelId: string): boolean {
    const state = this.getState(userId, channelId);
    return state?.status === "typing" && state.expiresAt > new Date();
  }

  private getKey(channelId: string, userId: string): string {
    return `${channelId}:${userId}`;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5000);
  }

  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, state] of this.typingStates) {
      if (state.expiresAt < now) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.typingStates.delete(key);
    }
    
    if (expiredKeys.length > 0) {
      logger.debug(`[TypingIndicator.${this.channelName}] Cleaned up ${expiredKeys.length} expired states`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.typingStates.clear();
  }
}

// ── Status Reactions ─────────────────────────────────────────────

export interface StatusReaction {
  id: string;
  type: "typing" | "sent" | "delivered" | "read" | "failed";
  emoji: string;
  timestamp: Date;
}

export class StatusReactions {
  private statusMessages = new Map<string, StatusReaction[]>();

  addStatus(messageId: string, status: StatusReaction["type"]): StatusReaction {
    const emojiMap: Record<StatusReaction["type"], string> = {
      typing: "⌨️",
      sent: "✅",
      delivered: "📤",
      read: "👁️",
      failed: "❌",
    };

    const statusReaction: StatusReaction = {
      id: `status_${Date.now()}`,
      type: status,
      emoji: emojiMap[status],
      timestamp: new Date(),
    };

    const existing = this.statusMessages.get(messageId) || [];
    existing.push(statusReaction);
    this.statusMessages.set(messageId, existing);

    return statusReaction;
  }

  getStatuses(messageId: string): StatusReaction[] {
    return this.statusMessages.get(messageId) || [];
  }

  clearStatuses(messageId: string): void {
    this.statusMessages.delete(messageId);
  }
}
