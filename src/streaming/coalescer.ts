// ============================================================
// 🦀 Krab — Block Coalescer for Streaming
// ============================================================
import { logger } from "../utils/logger.js";

export interface CoalesceOptions {
  minChars?: number;
  maxChars?: number;
  idleMs?: number;
  breakPreference?: "paragraph" | "newline" | "sentence" | "whitespace";
}

export interface CoalesceResult {
  text: string;
  shouldSend: boolean;
}

export class BlockCoalescer {
  private buffer = "";
  private lastAddTime = Date.now();
  private options: CoalesceOptions;

  constructor(options: CoalesceOptions = {}) {
    this.options = {
      minChars: 1500,
      maxChars: 3000,
      idleMs: 500,
      breakPreference: "paragraph",
      ...options
    };
  }

  /**
   * Add a block to the buffer
   */
  addBlock(block: string): CoalesceResult[] {
    this.buffer += this.getJoiner() + block;
    this.lastAddTime = Date.now();

    const results: CoalesceResult[] = [];

    // Check if buffer exceeds maxChars
    if (this.buffer.length >= (this.options.maxChars || 3000)) {
      results.push({
        text: this.buffer,
        shouldSend: true
      });
      this.buffer = "";
      return results;
    }

    // Check if buffer meets minChars and enough time has passed
    const timeSinceLastAdd = Date.now() - this.lastAddTime;
    if (this.buffer.length >= (this.options.minChars || 1500) &&
        timeSinceLastAdd >= (this.options.idleMs || 500)) {
      results.push({
        text: this.buffer,
        shouldSend: true
      });
      this.buffer = "";
    }

    return results;
  }

  /**
   * Flush remaining buffer
   */
  flush(): CoalesceResult | null {
    if (this.buffer.length === 0) return null;

    const result: CoalesceResult = {
      text: this.buffer,
      shouldSend: true
    };

    this.buffer = "";
    return result;
  }

  /**
   * Get the joiner string based on break preference
   */
  private getJoiner(): string {
    switch (this.options.breakPreference) {
      case "paragraph":
        return "\n\n";
      case "newline":
        return "\n";
      case "sentence":
        return " ";
      case "whitespace":
        return " ";
      default:
        return "\n\n";
    }
  }

  getBufferLength(): number {
    return this.buffer.length;
  }

  clearBuffer(): void {
    this.buffer = "";
  }
}
