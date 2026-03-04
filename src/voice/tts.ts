// ============================================================
// 🦀 Krab — Text-to-Speech (TTS) Integration
// ============================================================
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

// Dynamic imports for optional dependencies
let OpenAI: any = null;
let EdgeTTS: any = null;

export interface TTSOptions {
  provider?: "openai" | "edge-tts" | "elevenlabs";
  apiKey?: string;
  voice?: string;
  model?: string;
  speed?: number;
  outputFormat?: "mp3" | "wav" | "flac" | "aac";
}

export interface TTSResult {
  audioData: Buffer;
  contentType: string;
  duration?: number;
  filePath?: string;
}

export class TextToSpeech {
  private options: Required<TTSOptions>;

  constructor(options: TTSOptions = {}) {
    this.options = {
      provider: options.provider || "openai",
      apiKey: options.apiKey || process.env.OPENAI_API_KEY || "",
      voice: options.voice || "alloy", // OpenAI default
      model: options.model || "tts-1",
      speed: options.speed || 1.0,
      outputFormat: options.outputFormat || "mp3",
      ...options
    };
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import based on provider
      if (this.options.provider === "openai") {
        const openaiModule = await import("openai").catch(() => null);
        if (!openaiModule) {
          throw new Error("OpenAI SDK not installed. Install with: npm install openai");
        }
        OpenAI = openaiModule.default;

      } else if (this.options.provider === "edge-tts") {
        try {
          EdgeTTS = await import("edge-tts");
        } catch (error) {
          logger.warn("[TTS] EdgeTTS not available, falling back to OpenAI");
          this.options.provider = "openai";
          const openaiModule = await import("openai").catch(() => null);
          if (openaiModule) {
            OpenAI = openaiModule.default;
          }
        }
      }

      logger.info(`[TTS] Initialized with provider: ${this.options.provider}, voice: ${this.options.voice}`);

    } catch (error) {
      logger.error("[TTS] Failed to initialize:", error);
      throw error;
    }
  }

  async synthesizeSpeech(text: string, options?: Partial<TTSOptions>): Promise<TTSResult> {
    const opts = { ...this.options, ...options };

    if (!opts.apiKey && opts.provider === "openai") {
      throw new Error("API key required for TTS synthesis");
    }

    try {
      logger.info(`[TTS] Synthesizing speech: ${text.substring(0, 50)}...`);

      // Validate text length
      if (text.length > 4096) {
        throw new Error("Text too long. Maximum 4096 characters.");
      }

      let result: TTSResult;

      switch (opts.provider) {
        case "openai":
          result = await this.synthesizeWithOpenAI(text, opts);
          break;

        case "edge-tts":
          result = await this.synthesizeWithEdgeTTS(text, opts);
          break;

        default:
          throw new Error(`Unsupported TTS provider: ${opts.provider}`);
      }

      logger.info(`[TTS] Speech synthesis completed (${result.audioData.length} bytes)`);
      return result;

    } catch (error) {
      logger.error("[TTS] Synthesis failed:", error);
      throw new Error(`TTS synthesis failed: ${(error as Error).message}`);
    }
  }

  private async synthesizeWithOpenAI(text: string, opts: TTSOptions): Promise<TTSResult> {
    const openai = new OpenAI({
      apiKey: opts.apiKey
    });

    // Prepare TTS request
    const ttsRequest = {
      model: opts.model,
      input: text,
      voice: opts.voice as any,
      response_format: opts.outputFormat,
      speed: opts.speed
    };

    // Make API call
    const mp3 = await openai.audio.speech.create(ttsRequest);

    // Convert response to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    return {
      audioData: buffer,
      contentType: `audio/${opts.outputFormat}`,
      duration: this.estimateDuration(text, opts.speed || 1.0)
    };
  }

  private async synthesizeWithEdgeTTS(text: string, opts: TTSOptions): Promise<TTSResult> {
    if (!EdgeTTS) {
      throw new Error("EdgeTTS not available");
    }

    try {
      // Create EdgeTTS instance
      const tts = EdgeTTS.Communicate(text, opts.voice, {
        rate: opts.speed !== 1.0 ? `+${Math.round((opts.speed! - 1.0) * 100)}%` : undefined,
        outputFormat: opts.outputFormat
      });

      // Collect audio data
      const chunks: Buffer[] = [];
      for await (const chunk of tts) {
        chunks.push(chunk);
      }

      const audioBuffer = Buffer.concat(chunks);

      return {
        audioData: audioBuffer,
        contentType: `audio/${opts.outputFormat}`,
        duration: this.estimateDuration(text, opts.speed || 1.0)
      };

    } catch (error) {
      logger.error("[TTS] EdgeTTS synthesis failed:", error);
      throw error;
    }
  }

  async synthesizeToFile(text: string, outputPath: string, options?: Partial<TTSOptions>): Promise<TTSResult> {
    const result = await this.synthesizeSpeech(text, options);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(outputPath, result.audioData);

    return {
      ...result,
      filePath: outputPath
    };
  }

  private estimateDuration(text: string, speed: number = 1.0): number {
    // Rough estimation: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charsPerWord = 5;
    const estimatedWords = text.length / charsPerWord;
    const durationMinutes = estimatedWords / wordsPerMinute;

    // Adjust for speed
    return (durationMinutes * 60) / speed; // Convert to seconds
  }

  // Voice listing methods
  async getAvailableVoices(): Promise<Array<{ id: string; name: string; language: string; provider: string }>> {
    switch (this.options.provider) {
      case "openai":
        return this.getOpenAIVoices();
      case "edge-tts":
        return this.getEdgeTTSVoices();
      default:
        return [];
    }
  }

  private getOpenAIVoices(): Array<{ id: string; name: string; language: string; provider: string }> {
    return [
      { id: "alloy", name: "Alloy", language: "en", provider: "openai" },
      { id: "echo", name: "Echo", language: "en", provider: "openai" },
      { id: "fable", name: "Fable", language: "en", provider: "openai" },
      { id: "onyx", name: "Onyx", language: "en", provider: "openai" },
      { id: "nova", name: "Nova", language: "en", provider: "openai" },
      { id: "shimmer", name: "Shimmer", language: "en", provider: "openai" }
    ];
  }

  private async getEdgeTTSVoices(): Promise<Array<{ id: string; name: string; language: string; provider: string }>> {
    if (!EdgeTTS) {
      return [];
    }

    try {
      const voices = await EdgeTTS.listVoices();
      return voices.map((voice: any) => ({
        id: voice.ShortName,
        name: voice.FriendlyName,
        language: voice.Locale,
        provider: "edge-tts"
      }));
    } catch (error) {
      logger.error("[TTS] Failed to list EdgeTTS voices:", error);
      return [];
    }
  }

  // Utility methods
  getSupportedFormats(): string[] {
    return ["mp3", "wav", "flac", "aac"];
  }

  getMaxTextLength(): number {
    return 4096; // OpenAI limit
  }

  updateOptions(newOptions: Partial<TTSOptions>): void {
    this.options = { ...this.options, ...newOptions };
    logger.info("[TTS] Options updated");
  }

  getOptions(): TTSOptions {
    return { ...this.options };
  }
}

// Predefined TTS configurations
export const ttsConfigs = {
  thai: {
    provider: "openai" as const,
    voice: "alloy", // OpenAI doesn't have Thai voices yet
    model: "tts-1",
    speed: 1.0,
    outputFormat: "mp3" as const
  },

  english: {
    provider: "openai" as const,
    voice: "alloy",
    model: "tts-1",
    speed: 1.0,
    outputFormat: "mp3" as const
  },

  edgeTTS: {
    provider: "edge-tts" as const,
    voice: "en-US-AriaNeural",
    speed: 1.0,
    outputFormat: "mp3" as const
  }
};

// Factory function for creating TTS instances
export function createTTS(options: TTSOptions = {}): TextToSpeech {
  return new TextToSpeech(options);
}

// Export for dynamic loading
export default TextToSpeech;
