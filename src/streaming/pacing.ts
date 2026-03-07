// ============================================================
// 🦀 Krab — Human-like Pacing for Streaming
// ============================================================
import { logger } from "../utils/logger.js";

export type HumanDelayMode = "off" | "natural" | { minMs: number; maxMs: number };

export class HumanPacer {
  private mode: HumanDelayMode;

  constructor(mode: HumanDelayMode = "off") {
    this.mode = mode;
  }

  /**
   * Apply human-like delay before sending a block
   */
  async applyDelay(): Promise<void> {
    if (this.mode === "off") return;

    let delayMs: number;

    if (this.mode === "natural") {
      // Natural: 800–2500ms
      delayMs = Math.random() * (2500 - 800) + 800;
    } else if (typeof this.mode === "object") {
      // Custom range
      const { minMs, maxMs } = this.mode;
      delayMs = Math.random() * (maxMs - minMs) + minMs;
    } else {
      return;
    }

    logger.debug(`[HumanPacer] Applying ${delayMs.toFixed(0)}ms delay`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Check if pacing is enabled
   */
  isEnabled(): boolean {
    return this.mode !== "off";
  }

  /**
   * Update pacing mode
   */
  setMode(mode: HumanDelayMode): void {
    this.mode = mode;
  }
}
