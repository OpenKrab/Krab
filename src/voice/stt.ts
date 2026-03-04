// ============================================================
// 🦀 Krab — Speech-to-Text (STT) Integration
// ============================================================
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

// Dynamic imports for optional dependencies
let OpenAI: any = null;

export interface STTOptions {
  provider?: "openai" | "whisper-api" | "local-whisper";
  apiKey?: string;
  model?: string;
  language?: string;
  temperature?: number;
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
}

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }>;
}

export class SpeechToText {
  private options: Required<STTOptions>;

  constructor(options: STTOptions = {}) {
    this.options = {
      provider: options.provider || "openai",
      apiKey: options.apiKey || process.env.OPENAI_API_KEY || "",
      model: options.model || "whisper-1",
      language: options.language || "th", // Thai by default
      temperature: options.temperature || 0,
      responseFormat: options.responseFormat || "json",
      ...options
    };
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of OpenAI SDK
      const openaiModule = await import("openai").catch(() => null);
      if (!openaiModule) {
        throw new Error("OpenAI SDK not installed. Install with: npm install openai");
      }
      OpenAI = openaiModule.default;

      // Optional: Check for ffmpeg for local processing (removed for now)

      logger.info(`[STT] Initialized with provider: ${this.options.provider}`);

    } catch (error) {
      logger.error("[STT] Failed to initialize:", error);
      throw error;
    }
  }

  async transcribeAudio(audioFilePath: string): Promise<STTResult> {
    if (!this.options.apiKey) {
      throw new Error("API key required for STT transcription");
    }

    try {
      logger.info(`[STT] Transcribing audio file: ${audioFilePath}`);

      // Validate audio file
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Check file size (OpenAI has 25MB limit)
      const stats = fs.statSync(audioFilePath);
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (stats.size > maxSize) {
        throw new Error(`Audio file too large: ${stats.size} bytes (max: ${maxSize} bytes)`);
      }

      // Validate audio format
      const ext = path.extname(audioFilePath).toLowerCase();
      const supportedFormats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.flac', '.ogg'];
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported audio format: ${ext}. Supported: ${supportedFormats.join(', ')}`);
      }

      // Create OpenAI client
      const openai = new OpenAI({
        apiKey: this.options.apiKey
      });

      // Prepare transcription request
      const transcriptionRequest = {
        file: fs.createReadStream(audioFilePath),
        model: this.options.model,
        language: this.options.language,
        temperature: this.options.temperature,
        response_format: this.options.responseFormat
      };

      // Make API call
      const transcription = await openai.audio.transcriptions.create(transcriptionRequest);

      // Process response
      const result: STTResult = {
        text: typeof transcription === 'string' ? transcription : transcription.text,
        language: this.options.language,
        confidence: (transcription as any).confidence,
        duration: (transcription as any).duration,
        segments: (transcription as any).segments?.map((segment: any) => ({
          start: segment.start,
          end: segment.end,
          text: segment.text,
          confidence: segment.confidence
        }))
      };

      logger.info(`[STT] Transcription completed: ${result.text.substring(0, 100)}...`);
      return result;

    } catch (error) {
      logger.error("[STT] Transcription failed:", error);
      throw new Error(`STT transcription failed: ${(error as Error).message}`);
    }
  }

  async transcribeAudioBuffer(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<STTResult> {
    // Create temporary file from buffer
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `stt_${Date.now()}_${filename}`);

    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      const result = await this.transcribeAudio(tempFilePath);
      return result;

    } finally {
      // Clean up temporary file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (error) {
        logger.warn("[STT] Failed to clean up temp file:", tempFilePath);
      }
    }
  }

  async transcribeAudioUrl(audioUrl: string): Promise<STTResult> {
    try {
      logger.info(`[STT] Transcribing audio from URL: ${audioUrl}`);

      // Download audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'audio/wav';
      const extension = this.getExtensionFromMimeType(contentType);

      return await this.transcribeAudioBuffer(Buffer.from(audioBuffer), `audio${extension}`);

    } catch (error) {
      logger.error("[STT] URL transcription failed:", error);
      throw new Error(`STT URL transcription failed: ${(error as Error).message}`);
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'audio/wav': '.wav',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'audio/flac': '.flac'
    };

    return mimeToExt[mimeType] || '.wav';
  }

  // Utility methods
  getSupportedFormats(): string[] {
    return ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.flac', '.ogg'];
  }

  getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB
  }

  updateOptions(newOptions: Partial<STTOptions>): void {
    this.options = { ...this.options, ...newOptions };
    logger.info("[STT] Options updated");
  }

  getOptions(): STTOptions {
    return { ...this.options };
  }
}

// Predefined STT configurations
export const sttConfigs = {
  thai: {
    provider: "openai" as const,
    model: "whisper-1",
    language: "th",
    temperature: 0,
    responseFormat: "json" as const
  },

  english: {
    provider: "openai" as const,
    model: "whisper-1",
    language: "en",
    temperature: 0,
    responseFormat: "json" as const
  },

  multilingual: {
    provider: "openai" as const,
    model: "whisper-1",
    language: null, // Auto-detect
    temperature: 0,
    responseFormat: "verbose_json" as const
  }
};

// Factory function for creating STT instances
export function createSTT(options: STTOptions = {}): SpeechToText {
  return new SpeechToText(options);
}

// Export for dynamic loading
export default SpeechToText;
