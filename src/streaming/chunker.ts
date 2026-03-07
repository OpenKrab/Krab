// ============================================================
// 🦀 Krab — Embedded Block Chunker for Streaming
// ============================================================
import { logger } from "../utils/logger.js";

export interface ChunkOptions {
  minChars: number;
  maxChars: number;
  breakPreference?: "paragraph" | "newline" | "sentence" | "whitespace";
}

export interface ChunkResult {
  text: string;
  isComplete: boolean;
}

export class EmbeddedBlockChunker {
  private buffer = "";
  private options: ChunkOptions;

  constructor(options: ChunkOptions) {
    this.options = options;
  }

  /**
   * Add text to the buffer and return chunks as they become available
   */
  addText(text: string): ChunkResult[] {
    this.buffer += text;
    const chunks: ChunkResult[] = [];

    while (this.buffer.length >= this.options.minChars) {
      const chunk = this.extractChunk();
      if (chunk) {
        chunks.push(chunk);
      } else {
        // No good break point found, but buffer is too large
        break;
      }
    }

    return chunks;
  }

  /**
   * Flush remaining buffer as final chunk
   */
  flush(): ChunkResult | null {
    if (this.buffer.length === 0) return null;

    const result: ChunkResult = {
      text: this.buffer,
      isComplete: true
    };

    this.buffer = "";
    return result;
  }

  /**
   * Extract a chunk from the buffer based on preferences
   */
  private extractChunk(): ChunkResult | null {
    const { minChars, maxChars, breakPreference = "paragraph" } = this.options;

    if (this.buffer.length < minChars) return null;

    // Try to find break points in order of preference
    const breakStrategies = this.getBreakStrategies(breakPreference);
    let bestBreakPoint = -1;

    for (const strategy of breakStrategies) {
      const breakPoint = strategy.findBreak(this.buffer, minChars, maxChars);
      if (breakPoint !== -1) {
        bestBreakPoint = breakPoint;
        break;
      }
    }

    // If no good break point found and buffer exceeds maxChars, force break
    if (bestBreakPoint === -1 && this.buffer.length >= maxChars) {
      bestBreakPoint = this.findHardBreak(this.buffer, maxChars);
    }

    if (bestBreakPoint === -1) return null;

    const chunkText = this.buffer.substring(0, bestBreakPoint + 1);
    this.buffer = this.buffer.substring(bestBreakPoint + 1);

    return {
      text: chunkText,
      isComplete: false
    };
  }

  private getBreakStrategies(preference: string): Array<{ findBreak: (text: string, min: number, max: number) => number }> {
    const strategies = [];

    // Add strategies in preference order
    if (preference === "paragraph" || preference === "newline") {
      strategies.push({ findBreak: (text, min, max) => this.findParagraphBreak(text, min, max) });
    }
    if (preference === "newline" || preference === "sentence") {
      strategies.push({ findBreak: (text, min, max) => this.findNewlineBreak(text, min, max) });
    }
    if (preference === "sentence" || preference === "whitespace") {
      strategies.push({ findBreak: (text, min, max) => this.findSentenceBreak(text, min, max) });
    }
    strategies.push({ findBreak: (text, min, max) => this.findWhitespaceBreak(text, min, max) });

    return strategies;
  }

  private findParagraphBreak(text: string, minChars: number, maxChars: number): number {
    // Look for double newlines (paragraph breaks)
    const doubleNewline = /\n\s*\n/;
    let match;

    while ((match = doubleNewline.exec(text)) !== null) {
      const breakPoint = match.index + match[0].length - 1;
      if (breakPoint >= minChars && breakPoint < maxChars) {
        return breakPoint;
      }
      // Continue searching for better breaks
      doubleNewline.lastIndex = breakPoint + 1;
    }

    return -1;
  }

  private findNewlineBreak(text: string, minChars: number, maxChars: number): number {
    // Look for single newlines
    const newlineIndex = text.indexOf('\n', minChars);
    if (newlineIndex !== -1 && newlineIndex < maxChars) {
      return newlineIndex;
    }
    return -1;
  }

  private findSentenceBreak(text: string, minChars: number, maxChars: number): number {
    // Look for sentence endings (. ! ?)
    const sentencePattern = /[.!?]\s+/g;
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      const breakPoint = match.index + match[0].length - 1;
      if (breakPoint >= minChars && breakPoint < maxChars) {
        return breakPoint;
      }
    }

    return -1;
  }

  private findWhitespaceBreak(text: string, minChars: number, maxChars: number): number {
    // Look for any whitespace
    for (let i = Math.max(minChars, 1); i < Math.min(maxChars, text.length); i++) {
      if (/\s/.test(text[i])) {
        return i;
      }
    }
    return -1;
  }

  private findHardBreak(text: string, maxChars: number): number {
    // Handle code fences - don't split inside them
    const codeFencePattern = /```[\s\S]*?```/g;
    let lastFenceEnd = 0;
    let match;

    while ((match = codeFencePattern.exec(text)) !== null) {
      const fenceStart = match.index;
      const fenceEnd = fenceStart + match[0].length;

      // If maxChars is inside a code fence, close it and reopen
      if (maxChars > fenceStart && maxChars < fenceEnd) {
        // Find the end of the fence and break there
        return fenceEnd - 1;
      }

      lastFenceEnd = fenceEnd;
    }

    // Normal hard break at maxChars
    return Math.min(maxChars - 1, text.length - 1);
  }

  getBufferLength(): number {
    return this.buffer.length;
  }

  clearBuffer(): void {
    this.buffer = "";
  }
}
