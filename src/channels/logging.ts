// ============================================================
// 🦀 Krab — Message Logging
// ============================================================
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

export interface LogEntry {
  id: string;
  timestamp: Date;
  channel: string;
  direction: "inbound" | "outbound";
  senderId: string;
  senderName?: string;
  recipientId: string;
  content: string;
  type: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  metadata?: Record<string, unknown>;
}

export interface LogFilter {
  channel?: string;
  direction?: "inbound" | "outbound";
  senderId?: string;
  recipientId?: string;
  startTime?: Date;
  endTime?: Date;
  status?: string;
}

export class MessageLogger {
  private entries: LogEntry[] = [];
  private maxEntries: number;
  private logDir: string;
  private persistToDisk: boolean;

  constructor(options?: {
    maxEntries?: number;
    logDir?: string;
    persistToDisk?: boolean;
  }) {
    this.maxEntries = options?.maxEntries || 10000;
    this.logDir = options?.logDir || path.join(process.cwd(), ".krab", "logs");
    this.persistToDisk = options?.persistToDisk ?? true;
    
    if (this.persistToDisk) {
      this.ensureLogDir();
    }
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(entry: Omit<LogEntry, "id" | "timestamp">): LogEntry {
    const fullEntry: LogEntry = {
      ...entry,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
    };

    this.entries.push(fullEntry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    if (this.persistToDisk) {
      this.writeToFile(fullEntry);
    }

    logger.debug(`[MessageLogger] ${entry.direction} ${entry.channel}: ${entry.content.substring(0, 50)}...`);

    return fullEntry;
  }

  logInbound(
    channel: string,
    senderId: string,
    content: string,
    type: string = "text",
    metadata?: Record<string, unknown>
  ): LogEntry {
    return this.log({
      channel,
      direction: "inbound",
      senderId,
      recipientId: "agent",
      content,
      type,
      status: "delivered",
      metadata,
    });
  }

  logOutbound(
    channel: string,
    recipientId: string,
    content: string,
    type: string = "text",
    senderId: string = "agent",
    metadata?: Record<string, unknown>
  ): LogEntry {
    return this.log({
      channel,
      direction: "outbound",
      senderId,
      recipientId,
      content,
      type,
      status: "sent",
      metadata,
    });
  }

  updateStatus(messageId: string, status: LogEntry["status"]): void {
    const entry = this.entries.find((e) => e.id === messageId);
    if (entry) {
      entry.status = status;
    }
  }

  getEntry(messageId: string): LogEntry | undefined {
    return this.entries.find((e) => e.id === messageId);
  }

  query(filter: LogFilter): LogEntry[] {
    return this.entries.filter((entry) => {
      if (filter.channel && entry.channel !== filter.channel) return false;
      if (filter.direction && entry.direction !== filter.direction) return false;
      if (filter.senderId && entry.senderId !== filter.senderId) return false;
      if (filter.recipientId && entry.recipientId !== filter.recipientId) return false;
      if (filter.status && entry.status !== filter.status) return false;
      if (filter.startTime && entry.timestamp < filter.startTime) return false;
      if (filter.endTime && entry.timestamp > filter.endTime) return false;
      return true;
    });
  }

  getRecent(count: number = 100): LogEntry[] {
    return this.entries.slice(-count);
  }

  getByChannel(channel: string): LogEntry[] {
    return this.query({ channel });
  }

  getConversation(channel: string, userId: string): LogEntry[] {
    return this.entries.filter(
      (e) =>
        e.channel === channel &&
        (e.senderId === userId || e.recipientId === userId)
    );
  }

  private writeToFile(entry: LogEntry): void {
    const date = entry.timestamp.toISOString().split("T")[0];
    const filepath = path.join(this.logDir, `${date}.jsonl`);

    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(filepath, line);
  }

  loadFromFile(date: Date): LogEntry[] {
    const dateStr = date.toISOString().split("T")[0];
    const filepath = path.join(this.logDir, `${dateStr}.jsonl`);

    if (!fs.existsSync(filepath)) {
      return [];
    }

    const content = fs.readFileSync(filepath, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogEntry);
  }

  clear(): void {
    this.entries = [];
    logger.info("[MessageLogger] Cleared in-memory logs");
  }

  getStats(): {
    total: number;
    byChannel: Record<string, number>;
    byDirection: Record<"inbound" | "outbound", number>;
    byStatus: Record<string, number>;
  } {
    const byChannel: Record<string, number> = {};
    const byDirection: Record<"inbound" | "outbound", number> = {
      inbound: 0,
      outbound: 0,
    };
    const byStatus: Record<string, number> = {};

    for (const entry of this.entries) {
      byChannel[entry.channel] = (byChannel[entry.channel] || 0) + 1;
      byDirection[entry.direction]++;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    }

    return {
      total: this.entries.length,
      byChannel,
      byDirection,
      byStatus,
    };
  }
}
