// ============================================================
// 🦀 Krab — Message Queue (Runtime Cohesion)
// ============================================================
import crypto from "node:crypto";
import { logger } from "../utils/logger.js";

export type MessageStatus = "pending" | "processing" | "completed" | "failed";

export interface MessageRecord {
  id: string;
  channel?: string;
  senderId?: string;
  content: string;
  receivedAt: number;
  status: MessageStatus;
  updatedAt: number;
  error?: string;
}

export class MessageQueue {
  private readonly messages: Map<string, MessageRecord> = new Map();
  private readonly recentLimit: number = 50;

  constructor() {
    logger.info("[MessageQueue] Initialized");
  }

  enqueue(content: string, channel?: string, senderId?: string): MessageRecord {
    const id = `msg_${crypto.randomBytes(4).toString("hex")}`;
    const now = Date.now();
    const record: MessageRecord = {
      id,
      channel,
      senderId,
      content,
      receivedAt: now,
      status: "pending",
      updatedAt: now,
    };
    this.messages.set(id, record);
    logger.debug(`[MessageQueue] Enqueued message ${id}`);
    return { ...record };
  }

  dequeue(): MessageRecord | undefined {
    for (const [id, record] of this.messages.entries()) {
      if (record.status === "pending") {
        record.status = "processing";
        record.updatedAt = Date.now();
        logger.debug(`[MessageQueue] Dequeued message ${id}`);
        return { ...record };
      }
    }
    return undefined;
  }

  updateStatus(id: string, status: MessageStatus, error?: string): boolean {
    const record = this.messages.get(id);
    if (!record) {
      return false;
    }
    record.status = status;
    record.updatedAt = Date.now();
    if (error) {
      record.error = error;
    }
    logger.debug(`[MessageQueue] Updated status of message ${id} to ${status}`);
    return true;
  }

  getDepth(): number {
    return this.messages.size;
  }

  getPendingCount(): number {
    let count = 0;
    for (const record of this.messages.values()) {
      if (record.status === "pending") {
        count++;
      }
    }
    return count;
  }

  getProcessingCount(): number {
    let count = 0;
    for (const record of this.messages.values()) {
      if (record.status === "processing") {
        count++;
      }
    }
    return count;
  }

  getRecentMessages(limit: number = this.recentLimit): MessageRecord[] {
    const sorted = Array.from(this.messages.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted.slice(0, limit).map(record => ({ ...record }));
  }
}

export const messageQueue = new MessageQueue();
