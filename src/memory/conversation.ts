// ============================================================
// 🦀 Krab — Conversation Memory (Phase 1: In-memory buffer)
// ============================================================
import type { Message } from "../core/types.js";
import { logger } from "../utils/logger.js";

export class ConversationMemory {
  private messages: Message[] = [];
  private readonly limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  add(message: Message): void {
    this.messages.push(message);

    // Trim oldest messages if over limit (keep system prompt)
    if (this.messages.length > this.limit) {
      const systemMessages = this.messages.filter((m) => m.role === "system");
      const nonSystem = this.messages.filter((m) => m.role !== "system");
      const trimmed = nonSystem.slice(-this.limit + systemMessages.length);
      this.messages = [...systemMessages, ...trimmed];
      logger.debug(`[Memory] Trimmed to ${this.messages.length} messages`);
    }
  }

  getAll(): Message[] {
    return [...this.messages];
  }

  getRecent(n: number): Message[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    const systemMessages = this.messages.filter((m) => m.role === "system");
    this.messages = systemMessages;
    logger.info("[Memory] Conversation cleared (system prompt preserved)");
  }

  getStats(): { total: number; limit: number; byRole: Record<string, number> } {
    const byRole: Record<string, number> = {};
    for (const m of this.messages) {
      byRole[m.role] = (byRole[m.role] || 0) + 1;
    }
    return { total: this.messages.length, limit: this.limit, byRole };
  }
}
