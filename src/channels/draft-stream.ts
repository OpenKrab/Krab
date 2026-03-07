// ============================================================
// 🦀 Krab — Draft Stream Loop (Streaming Response)
// ============================================================
import { logger } from "../utils/logger.js";

export interface DraftChunk {
  text: string;
  isFirst: boolean;
  isFinal: boolean;
  timestamp: Date;
}

export interface StreamControls {
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isPaused: () => boolean;
  isStopped: () => boolean;
}

export interface StreamConfig {
  minChunkSize: number;
  idleMs: number;
  maxBufferSize: number;
  sendImmediately: boolean;
}

export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  minChunkSize: 100,
  idleMs: 1500,
  maxBufferSize: 2000,
  sendImmediately: true,
};

export class DraftStreamLoop {
  private buffer = "";
  private isPaused = false;
  private isStopped = false;
  private lastSendTime = 0;
  private config: StreamConfig;
  private resolveWait: ((chunk: DraftChunk | null) => void) | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = { ...DEFAULT_STREAM_CONFIG, ...config };
  }

  async *streamChunks(): AsyncGenerator<DraftChunk> {
    while (!this.isStopped) {
      const chunk = await this.waitForChunk();
      
      if (chunk === null) {
        if (this.buffer.length > 0) {
          yield this.flushBuffer();
        }
        break;
      }

      if (chunk.text) {
        this.buffer += chunk.text;
        
        const shouldFlush = 
          this.buffer.length >= this.config.maxBufferSize ||
          (this.buffer.length >= this.config.minChunkSize && this.timeSinceLastSend() >= this.config.idleMs);

        if (shouldFlush) {
          yield this.flushBuffer();
        }
      }

      if (chunk.isFinal) {
        if (this.buffer.length > 0) {
          yield this.flushBuffer();
        }
        break;
      }
    }
  }

  append(text: string, isFirst = false, isFinal = false): void {
    if (this.isStopped || this.isPaused) return;

    const chunk: DraftChunk = {
      text,
      isFirst,
      isFinal,
      timestamp: new Date(),
    };

    if (this.resolveWait) {
      const resolve = this.resolveWait;
      this.resolveWait = null;
      resolve(chunk);
    }

    this.lastSendTime = Date.now();
  }

  pause(): void {
    this.isPaused = true;
    logger.debug("[DraftStreamLoop] Paused");
  }

  resume(): void {
    this.isPaused = false;
    logger.debug("[DraftStreamLoop] Resumed");
  }

  stop(): void {
    this.isStopped = true;
    if (this.resolveWait) {
      this.resolveWait(null);
      this.resolveWait = null;
    }
    logger.debug("[DraftStreamLoop] Stopped");
  }

  getControls(): StreamControls {
    return {
      pause: () => this.pause(),
      resume: () => this.resume(),
      stop: () => this.stop(),
      isPaused: () => this.isPaused,
      isStopped: () => this.isStopped,
    };
  }

  getBuffer(): string {
    return this.buffer;
  }

  clearBuffer(): void {
    this.buffer = "";
  }

  private async waitForChunk(): Promise<DraftChunk | null> {
    return new Promise((resolve) => {
      if (this.buffer.length >= this.config.minChunkSize) {
        resolve({ text: "", isFirst: false, isFinal: false, timestamp: new Date() });
        return;
      }

      this.resolveWait = resolve;

      this.idleTimer = setTimeout(() => {
        if (this.resolveWait) {
          const r = this.resolveWait;
          this.resolveWait = null;
          r({ text: "", isFirst: false, isFinal: false, timestamp: new Date() });
        }
      }, this.config.idleMs);
    });
  }

  private flushBuffer(): DraftChunk {
    const text = this.buffer;
    this.buffer = "";
    this.lastSendTime = Date.now();

    return {
      text,
      isFirst: false,
      isFinal: false,
      timestamp: new Date(),
    };
  }

  private timeSinceLastSend(): number {
    return Date.now() - this.lastSendTime;
  }
}

// ── Streaming Strategy ───────────────────────────────────────────

export type StreamingStrategy = "full" | "chunked" | "coalesced";

export interface StreamCoalesceConfig {
  minChars: number;
  idleMs: number;
}

export class StreamCoalescer {
  private pendingText = "";
  private config: StreamCoalesceConfig;
  private timer: NodeJS.Timeout | null = null;
  private resolveNext: ((text: string) => void) | null = null;

  constructor(config: StreamCoalesceConfig) {
    this.config = config;
  }

  async coalesce(text: string): Promise<string> {
    this.pendingText += text;

    if (this.pendingText.length >= this.config.minChars) {
      const result = this.pendingText;
      this.pendingText = "";
      return result;
    }

    return new Promise((resolve) => {
      this.resolveNext = resolve;

      this.timer = setTimeout(() => {
        const result = this.pendingText;
        this.pendingText = "";
        this.resolveNext = null;
        resolve(result);
      }, this.config.idleMs);
    });
  }

  flush(): string {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const result = this.pendingText;
    this.pendingText = "";
    
    if (this.resolveNext) {
      const r = this.resolveNext;
      this.resolveNext = null;
      r(result);
    }

    return result;
  }
}
