// ============================================================
// 🦀 Krab — Thread Bindings
// ============================================================
import { logger } from "../utils/logger.js";

export type ThreadReplyMode = "off" | "first" | "all";

export interface ThreadBinding {
  threadId: string;
  parentMessageId: string;
  channelId: string;
  replyCount: number;
  lastReplyAt: Date;
  participants: Set<string>;
}

export interface ThreadContext {
  channel: string;
  threadId?: string;
  parentMessageId?: string;
  replyToId?: string;
  replyToIdFull?: string;
  nativeChannelId?: string;
}

export class ThreadBindings {
  private threads = new Map<string, ThreadBinding>();
  private replyMode: ThreadReplyMode = "first";
  private config: {
    maxParticipants: number;
    inactiveTimeoutMs: number;
  };

  constructor(replyMode: ThreadReplyMode = "first", config?: {
    maxParticipants?: number;
    inactiveTimeoutMs?: number;
  }) {
    this.replyMode = replyMode;
    this.config = {
      maxParticipants: config?.maxParticipants || 50,
      inactiveTimeoutMs: config?.inactiveTimeoutMs || 30 * 60 * 1000,
    };
  }

  createThread(
    threadId: string,
    parentMessageId: string,
    channelId: string,
    creatorId: string
  ): ThreadBinding {
    const binding: ThreadBinding = {
      threadId,
      parentMessageId,
      channelId,
      replyCount: 0,
      lastReplyAt: new Date(),
      participants: new Set([creatorId]),
    };

    this.threads.set(threadId, binding);
    logger.debug(`[ThreadBindings] Created thread: ${threadId}`);

    return binding;
  }

  addReply(
    threadId: string,
    messageId: string,
    senderId: string
  ): ThreadBinding | null {
    const thread = this.threads.get(threadId);
    
    if (!thread) {
      logger.warn(`[ThreadBindings] Thread not found: ${threadId}`);
      return null;
    }

    thread.replyCount++;
    thread.lastReplyAt = new Date();
    thread.participants.add(senderId);

    if (thread.participants.size > this.config.maxParticipants) {
      logger.warn(`[ThreadBindings] Thread ${threadId} exceeded max participants`);
    }

    return thread;
  }

  getThread(threadId: string): ThreadBinding | undefined {
    return this.threads.get(threadId);
  }

  getThreadByMessage(messageId: string): ThreadBinding | undefined {
    for (const thread of this.threads.values()) {
      if (thread.parentMessageId === messageId) {
        return thread;
      }
    }
    return undefined;
  }

  resolveContext(
    messageId: string,
    replyToId?: string,
    channelId?: string
  ): ThreadContext {
    const thread = this.getThreadByMessage(messageId);
    
    if (thread) {
      return {
        channel: thread.channelId,
        threadId: thread.threadId,
        parentMessageId: thread.parentMessageId,
      };
    }

    if (replyToId) {
      const parentThread = this.getThreadByMessage(replyToId);
      if (parentThread) {
        return {
          channel: parentThread.channelId,
          threadId: parentThread.threadId,
          parentMessageId: parentThread.parentMessageId,
          replyToId,
        };
      }
    }

    return {
      channel: channelId || "",
      replyToId,
    };
  }

  shouldThread(replyToId?: string): boolean {
    if (this.replyMode === "off") return false;
    if (!replyToId) return false;
    return true;
  }

  getReplyMode(): ThreadReplyMode {
    return this.replyMode;
  }

  setReplyMode(mode: ThreadReplyMode): void {
    this.replyMode = mode;
    logger.info(`[ThreadBindings] Reply mode set to: ${mode}`);
  }

  getActiveThreads(channelId?: string): ThreadBinding[] {
    const now = Date.now();
    const threads: ThreadBinding[] = [];

    for (const thread of this.threads.values()) {
      if (channelId && thread.channelId !== channelId) continue;
      
      const inactiveMs = now - thread.lastReplyAt.getTime();
      if (inactiveMs < this.config.inactiveTimeoutMs) {
        threads.push(thread);
      }
    }

    return threads.sort((a, b) => 
      b.lastReplyAt.getTime() - a.lastReplyAt.getTime()
    );
  }

  archiveThread(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      logger.info(`[ThreadBindings] Archiving thread: ${threadId} (replies: ${thread.replyCount})`);
      this.threads.delete(threadId);
    }
  }

  getParticipantCount(threadId: string): number {
    return this.threads.get(threadId)?.participants.size || 0;
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [threadId, thread] of this.threads) {
      const inactiveMs = now - thread.lastReplyAt.getTime();
      if (inactiveMs > this.config.inactiveTimeoutMs) {
        this.threads.delete(threadId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[ThreadBindings] Cleaned up ${cleaned} inactive threads`);
    }

    return cleaned;
  }
}
