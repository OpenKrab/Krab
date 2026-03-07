// ============================================================
// 🦀 Krab — Streaming Response Dispatcher
// ============================================================
import { EmbeddedBlockChunker, ChunkOptions } from "./chunker.js";
import { BlockCoalescer, CoalesceOptions } from "./coalescer.js";
import { HumanPacer, HumanDelayMode } from "./pacing.js";
import { logger } from "../utils/logger.js";

export interface StreamingOptions {
  enabled: boolean;
  breakMode: "text_end" | "message_end";
  chunk: ChunkOptions;
  coalesce: CoalesceOptions;
  pacing: HumanDelayMode;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  maxLinesPerMessage?: number;
}

export interface StreamingDispatcher {
  sendBlock: (text: string) => Promise<void>;
  sendFinal: (text: string) => Promise<void>;
}

export class StreamingResponseDispatcher {
  private chunker?: EmbeddedBlockChunker;
  private coalescer?: BlockCoalescer;
  private pacer: HumanPacer;
  private options: StreamingOptions;
  private dispatcher: StreamingDispatcher;
  private buffer: string[] = [];
  private isStreaming = false;

  constructor(options: StreamingOptions, dispatcher: StreamingDispatcher) {
    this.options = options;
    this.dispatcher = dispatcher;
    this.pacer = new HumanPacer(options.pacing);

    if (options.enabled) {
      this.chunker = new EmbeddedBlockChunker(options.chunk);
      this.coalescer = new BlockCoalescer(options.coalesce);
    }
  }

  /**
   * Send a response, either as streaming blocks or all at once
   */
  async sendResponse(response: string): Promise<void> {
    if (!this.options.enabled) {
      // Send full response
      await this.dispatcher.sendFinal(response);
      return;
    }

    this.isStreaming = true;

    try {
      if (this.options.breakMode === "message_end") {
        // Wait until full response, then chunk
        await this.sendChunkedResponse(response);
      } else {
        // Stream as text becomes available (simulate for now)
        await this.sendChunkedResponse(response);
      }
    } finally {
      this.isStreaming = false;
    }
  }

  /**
   * Send response in chunks
   */
  private async sendChunkedResponse(response: string): Promise<void> {
    if (!this.chunker || !this.coalescer) return;

    // Process the entire response through chunker
    const chunks = this.chunker.addText(response);
    const finalChunk = this.chunker.flush();

    if (finalChunk) {
      chunks.push(finalChunk);
    }

    // Send chunks with coalescing and pacing
    for (const chunk of chunks) {
      if (!chunk.isComplete) {
        // Add to coalescer
        const coalesceResults = this.coalescer.addBlock(chunk.text);

        for (const result of coalesceResults) {
          if (result.shouldSend) {
            await this.pacer.applyDelay();
            await this.dispatcher.sendBlock(result.text);
          }
        }
      }
    }

    // Flush any remaining coalesced content
    const finalResult = this.coalescer.flush();
    if (finalResult?.shouldSend) {
      await this.pacer.applyDelay();
      await this.dispatcher.sendBlock(finalResult.text);
    }
  }

  /**
   * Check if currently streaming
   */
  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Get current buffer status
   */
  getBufferStatus(): { chunker: number; coalescer: number } {
    return {
      chunker: this.chunker?.getBufferLength() || 0,
      coalescer: this.coalescer?.getBufferLength() || 0
    };
  }
}
