// ============================================================
// 🦀 Krab — Status Reactions (Agent State via Emoji)
// ============================================================
import { logger } from "../utils/logger.js";

export interface StatusReactionAdapter {
  setReaction: (emoji: string) => Promise<void>;
  removeReaction?: (emoji: string) => Promise<void>;
}

export interface StatusReactionEmojis {
  queued?: string;
  thinking?: string;
  tool?: string;
  coding?: string;
  web?: string;
  done?: string;
  error?: string;
  stallSoft?: string;
  stallHard?: string;
}

export interface StatusReactionTiming {
  debounceMs?: number;
  stallSoftMs?: number;
  stallHardMs?: number;
  doneHoldMs?: number;
  errorHoldMs?: number;
}

export const DEFAULT_EMOJIS: Required<StatusReactionEmojis> = {
  queued: "👀",
  thinking: "🤔",
  tool: "🔥",
  coding: "👨‍💻",
  web: "⚡",
  done: "👍",
  error: "😱",
  stallSoft: "🥱",
  stallHard: "😨",
};

export const DEFAULT_TIMING: Required<StatusReactionTiming> = {
  debounceMs: 700,
  stallSoftMs: 10000,
  stallHardMs: 30000,
  doneHoldMs: 1500,
  errorHoldMs: 2500,
};

export const CODING_TOOL_TOKENS = [
  "exec",
  "process",
  "read",
  "write",
  "edit",
  "session_status",
  "bash",
  "run",
  "code",
];

export class StatusReactionController {
  private adapter: StatusReactionAdapter | null = null;
  private emojis: Required<StatusReactionEmojis>;
  private timing: Required<StatusReactionTiming>;
  private currentEmoji: string = "";
  private lastUpdateTime = 0;
  private state: "idle" | "queued" | "thinking" | "tool" | "done" | "error" = "idle";
  private stallTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    adapter: StatusReactionAdapter,
    emojis?: StatusReactionEmojis,
    timing?: StatusReactionTiming
  ) {
    this.adapter = adapter;
    this.emojis = { ...DEFAULT_EMOJIS, ...emojis };
    this.timing = { ...DEFAULT_TIMING, ...timing };
  }

  setAdapter(adapter: StatusReactionAdapter): void {
    this.adapter = adapter;
  }

  async setQueued(): Promise<void> {
    await this.setState("queued", this.emojis.queued);
  }

  async setThinking(): Promise<void> {
    await this.setState("thinking", this.emojis.thinking);
  }

  async setTool(toolName?: string): Promise<void> {
    let emoji = this.emojis.tool;

    if (toolName) {
      const lowerTool = toolName.toLowerCase();
      if (CODING_TOOL_TOKENS.some((t) => lowerTool.includes(t))) {
        emoji = this.emojis.coding;
      } else if (lowerTool.includes("web") || lowerTool.includes("http")) {
        emoji = this.emojis.web;
      }
    }

    await this.setState("tool", emoji);
  }

  async setDone(): Promise<void> {
    await this.setState("done", this.emojis.done);
    
    setTimeout(async () => {
      if (this.state === "done") {
        await this.clear();
      }
    }, this.timing.doneHoldMs);
  }

  async setError(): Promise<void> {
    await this.setState("error", this.emojis.error);
    
    setTimeout(async () => {
      if (this.state === "error") {
        await this.clear();
      }
    }, this.timing.errorHoldMs);
  }

  async clear(): Promise<void> {
    this.clearStallTimer();
    this.state = "idle";
    this.currentEmoji = "";
    
    if (this.adapter) {
      try {
        await this.adapter.setReaction("");
      } catch (error) {
        logger.warn("[StatusReactions] Failed to clear:", error);
      }
    }
  }

  async restoreInitial(): Promise<void> {
    if (this.currentEmoji) {
      await this.setReaction(this.currentEmoji);
    }
  }

  getState(): string {
    return this.state;
  }

  private async setState(newState: "idle" | "queued" | "thinking" | "tool" | "done" | "error", emoji: string): Promise<void> {
    this.clearStallTimer();
    this.state = newState;

    if (newState === "thinking" || newState === "tool" || newState === "queued") {
      this.startStallTimer();
    }

    await this.setReaction(emoji);
  }

  private async setReaction(emoji: string): Promise<void> {
    if (!this.adapter) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    if (timeSinceLastUpdate < this.timing.debounceMs!) {
      this.clearDebounceTimer();
      this.debounceTimer = setTimeout(() => {
        this.applyReaction(emoji);
      }, this.timing.debounceMs);
      return;
    }

    await this.applyReaction(emoji);
  }

  private async applyReaction(emoji: string): Promise<void> {
    if (!this.adapter) return;

    try {
      if (this.currentEmoji && this.adapter.removeReaction) {
        await this.adapter.removeReaction(this.currentEmoji);
      }
      
      if (emoji) {
        await this.adapter.setReaction(emoji);
      }
      
      this.currentEmoji = emoji;
      this.lastUpdateTime = Date.now();
    } catch (error) {
      logger.warn("[StatusReactions] Failed to set reaction:", error);
    }
  }

  private startStallTimer(): void {
    this.clearStallTimer();

    this.stallTimer = setTimeout(async () => {
      if (this.state === "thinking" || this.state === "tool") {
        const isHardStall = Date.now() - this.lastUpdateTime > this.timing.stallHardMs!;
        const emoji = isHardStall ? this.emojis.stallHard : this.emojis.stallSoft;
        await this.setReaction(emoji);
      }
    }, this.timing.stallSoftMs);
  }

  private clearStallTimer(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  destroy(): void {
    this.clearStallTimer();
    this.clearDebounceTimer();
    this.adapter = null;
  }
}

// ── Status Reaction Manager (Multiple Chats) ────────────────────

export class StatusReactionManager {
  private controllers = new Map<string, StatusReactionController>();

  getController(chatId: string, adapter: StatusReactionAdapter): StatusReactionController {
    let controller = this.controllers.get(chatId);
    
    if (!controller) {
      controller = new StatusReactionController(adapter);
      this.controllers.set(chatId, controller);
    } else {
      controller.setAdapter(adapter);
    }

    return controller;
  }

  removeController(chatId: string): void {
    const controller = this.controllers.get(chatId);
    if (controller) {
      controller.destroy();
      this.controllers.delete(chatId);
    }
  }

  clearAll(): void {
    for (const controller of this.controllers.values()) {
      controller.destroy();
    }
    this.controllers.clear();
  }

  getActiveCount(): number {
    return this.controllers.size;
  }
}
