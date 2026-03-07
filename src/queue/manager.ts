// ============================================================
// 🦀 Krab — Queue Manager (Message Processing Queue)
// ============================================================
import { logger } from "../utils/logger.js";
import { BaseMessage } from "../channels/base.js";

export type QueueMode = "steer" | "followup" | "collect" | "interrupt";

export interface QueueConfig {
  mode: QueueMode;
  debounceMs: number;
  cap: number;
  drop: "old" | "new" | "summarize";
}

export interface QueuedItem {
  id: string;
  message: BaseMessage;
  sessionKey: string;
  timestamp: number;
  priority: number;
}

export interface QueueStats {
  totalQueued: number;
  activeLanes: number;
  averageWaitTime: number;
}

export class QueueManager {
  private config: QueueConfig;
  private queues: Map<string, QueuedItem[]> = new Map(); // sessionKey -> items
  private activeRuns: Set<string> = new Set(); // sessionKey -> active
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: QueueConfig = {
    mode: "collect",
    debounceMs: 1000,
    cap: 20,
    drop: "summarize"
  }) {
    this.config = config;
  }

  /**
   * Queue a message for processing
   */
  async queueMessage(
    message: BaseMessage,
    sessionKey: string,
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    const item: QueuedItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      sessionKey,
      timestamp: Date.now(),
      priority: 0
    };

    // Get or create queue for session
    let queue = this.queues.get(sessionKey) || [];
    this.queues.set(sessionKey, queue);

    // Apply queue mode logic
    switch (this.config.mode) {
      case "steer":
        await this.processSteerMode(item, processor);
        break;
      case "followup":
        await this.processFollowupMode(item, queue, processor);
        break;
      case "collect":
        await this.processCollectMode(item, queue, processor);
        break;
      case "interrupt":
        await this.processInterruptMode(item, processor);
        break;
    }
  }

  private async processSteerMode(
    item: QueuedItem,
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    // Process immediately if no active run, otherwise queue
    if (!this.activeRuns.has(item.sessionKey)) {
      await this.processItem(item, processor);
    } else {
      // In steer mode, we'd inject into current run
      // For simplicity, queue for now
      const queue = this.queues.get(item.sessionKey)!;
      queue.push(item);
      this.enforceQueueLimits(queue);
    }
  }

  private async processFollowupMode(
    item: QueuedItem,
    queue: QueuedItem[],
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    // Always queue for next turn
    queue.push(item);
    this.enforceQueueLimits(queue);

    // Process if no active run
    if (!this.activeRuns.has(item.sessionKey)) {
      await this.processQueuedItems(item.sessionKey, processor);
    }
  }

  private async processCollectMode(
    item: QueuedItem,
    queue: QueuedItem[],
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    // Add to queue
    queue.push(item);
    this.enforceQueueLimits(queue);

    // Debounce processing
    this.debouncedProcess(item.sessionKey, processor);
  }

  private async processInterruptMode(
    item: QueuedItem,
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    // Interrupt current run and process immediately
    // For simplicity, just process immediately
    await this.processItem(item, processor);
  }

  private async processItem(
    item: QueuedItem,
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    this.activeRuns.add(item.sessionKey);

    try {
      const waitTime = Date.now() - item.timestamp;
      if (waitTime > 2000) {
        logger.debug(`[Queue] Processed queued item after ${waitTime}ms wait`);
      }

      await processor(item.message);
    } finally {
      this.activeRuns.delete(item.sessionKey);

      // Process next item if any
      const queue = this.queues.get(item.sessionKey);
      if (queue && queue.length > 0) {
        const nextItem = queue.shift()!;
        setImmediate(() => this.processItem(nextItem, processor));
      }
    }
  }

  private async processQueuedItems(
    sessionKey: string,
    processor: (msg: BaseMessage) => Promise<void>
  ): Promise<void> {
    const queue = this.queues.get(sessionKey);
    if (!queue || queue.length === 0 || this.activeRuns.has(sessionKey)) {
      return;
    }

    // Process next item
    const item = queue.shift()!;
    await this.processItem(item, processor);
  }

  private debouncedProcess(
    sessionKey: string,
    processor: (msg: BaseMessage) => Promise<void>
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(sessionKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(sessionKey);
      await this.processQueuedItems(sessionKey, processor);
    }, this.config.debounceMs);

    this.debounceTimers.set(sessionKey, timer);
  }

  private enforceQueueLimits(queue: QueuedItem[]): void {
    if (queue.length <= this.config.cap) {
      return;
    }

    const excess = queue.length - this.config.cap;

    switch (this.config.drop) {
      case "old":
        // Remove oldest items
        queue.splice(0, excess);
        break;
      case "new":
        // Keep only newest items
        queue.splice(0, queue.length - this.config.cap);
        break;
      case "summarize":
        // For now, just drop oldest (summarization would be complex)
        queue.splice(0, excess);
        break;
    }

    logger.debug(`[Queue] Dropped ${excess} items due to capacity limit`);
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    let totalQueued = 0;
    let totalWaitTime = 0;
    let itemCount = 0;

    for (const queue of this.queues.values()) {
      totalQueued += queue.length;
      for (const item of queue) {
        totalWaitTime += Date.now() - item.timestamp;
        itemCount++;
      }
    }

    return {
      totalQueued,
      activeLanes: this.activeRuns.size,
      averageWaitTime: itemCount > 0 ? totalWaitTime / itemCount : 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.clear();
    this.activeRuns.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}

// Export singleton instance
export const queueManager = new QueueManager();
