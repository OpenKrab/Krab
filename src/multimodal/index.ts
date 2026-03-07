// ============================================================
// 🦀 Krab — Multi-modal Support (Images, Audio, Video)
// ============================================================
import { logger } from "../utils/logger.js";
import type { BaseMessage } from "../channels/base.js";
import * as fs from "fs";
import * as path from "path";

// ── Multi-modal Message Types ──────────────────────────────────────
export interface MediaAttachment {
  type: "image" | "audio" | "video" | "file";
  url?: string;
  buffer?: Buffer;
  filename?: string;
  mimeType?: string;
  size?: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
  };
}

export interface MultiModalMessage extends BaseMessage {
  media?: MediaAttachment[];
  voiceMessage?: boolean;
  transcription?: string;
  visionAnalysis?: string;
}

// ── Media Processing Interface ─────────────────────────────────────
export interface MediaProcessor {
  processImage(buffer: Buffer, filename: string): Promise<{
    buffer: Buffer;
    metadata: { width: number; height: number; size: number };
  }>;
  processAudio(buffer: Buffer, filename: string): Promise<{
    buffer: Buffer;
    transcription: string;
    metadata: { duration: number; size: number };
  }>;
  processVideo(buffer: Buffer, filename: string): Promise<{
    buffer: Buffer;
    thumbnail: Buffer;
    metadata: { duration: number; width: number; height: number; size: number };
  }>;
  extractTextFromImage(buffer: Buffer): Promise<string>;
  generateThumbnail(buffer: Buffer, width: number, height: number): Promise<Buffer>;
}

// ── Vision Analysis Interface ──────────────────────────────────────
export interface VisionAnalyzer {
  analyzeImage(imageBuffer: Buffer, prompt?: string): Promise<{
    description: string;
    objects: string[];
    text: string[];
    sentiment: "positive" | "negative" | "neutral";
    confidence: number;
  }>;
  describeImage(imageBuffer: Buffer): Promise<string>;
  detectObjects(imageBuffer: Buffer): Promise<string[]>;
  extractText(imageBuffer: Buffer): Promise<string[]>;
}

// ── Audio Processing Interface ─────────────────────────────────────
export interface AudioProcessor {
  transcribeAudio(audioBuffer: Buffer): Promise<{
    text: string;
    confidence: number;
    language: string;
  }>;
  generateSpeech(text: string, voice?: string): Promise<Buffer>;
  detectLanguage(audioBuffer: Buffer): Promise<string>;
  getAudioDuration(audioBuffer: Buffer): Promise<number>;
}

// ── Media Storage Interface ────────────────────────────────────────
export interface MediaStorage {
  store(buffer: Buffer, filename: string, metadata?: any): Promise<string>;
  retrieve(url: string): Promise<Buffer>;
  delete(url: string): Promise<void>;
  getMetadata(url: string): Promise<any>;
  list(prefix?: string): Promise<string[]>;
}

// ── Multi-modal Channel Enhancements ───────────────────────────────
export interface MultiModalChannel {
  // Media sending capabilities
  sendImage(imageBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void>;
  sendAudio(audioBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void>;
  sendVideo(videoBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void>;
  sendFile(fileBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void>;

  // Media processing capabilities
  processIncomingMedia(media: MediaAttachment[]): Promise<MultiModalMessage>;

  // Voice message support
  supportsVoiceMessages(): boolean;
  processVoiceMessage(audioBuffer: Buffer): Promise<{
    transcription: string;
    response: string;
  }>;

  // Vision capabilities
  supportsVision(): boolean;
  analyzeImage(imageBuffer: Buffer): Promise<string>;

  // Media limits
  getMediaLimits(): {
    maxImageSize: number;
    maxAudioSize: number;
    maxVideoSize: number;
    maxFileSize: number;
    supportedImageTypes: string[];
    supportedAudioTypes: string[];
    supportedVideoTypes: string[];
    supportedFileTypes: string[];
  };
}

// ── Default Media Processor Implementation ──────────────────────────
export class DefaultMediaProcessor implements MediaProcessor {
  async processImage(buffer: Buffer, filename: string): Promise<{
    buffer: Buffer;
    metadata: { width: number; height: number; size: number };
  }> {
    const dimensions = this.getImageDimensions(buffer);
    return {
      buffer,
      metadata: {
        width: dimensions.width,
        height: dimensions.height,
        size: buffer.length
      }
    };
  }

  async processAudio(buffer: Buffer, filename: string): Promise<{
    buffer: Buffer;
    transcription: string;
    metadata: { duration: number; size: number };
  }> {
    const { createVoiceManager } = await import("../voice/tools.js");
    const voiceManager = createVoiceManager();
    await voiceManager.initialize();
    const transcriptionResult = await voiceManager.transcribeAudioBuffer(buffer, filename);
    return {
      buffer,
      transcription: transcriptionResult.text,
      metadata: {
        duration: transcriptionResult.duration || 0,
        size: buffer.length
      }
    };
  }

  async processVideo(buffer: Buffer, filename: string): Promise<{
    buffer: Buffer;
    thumbnail: Buffer;
    metadata: { duration: number; width: number; height: number; size: number };
  }> {
    const thumbnail = await this.generateThumbnail(buffer, 320, 180);

    return {
      buffer,
      thumbnail,
      metadata: {
        duration: 0,
        width: 320,
        height: 180,
        size: buffer.length
      }
    };
  }

  async extractTextFromImage(buffer: Buffer): Promise<string> {
    return "";
  }

  async generateThumbnail(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    return buffer.subarray(0, Math.min(buffer.length, 4096));
  }

  private getImageDimensions(buffer: Buffer): { width: number; height: number } {
    if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
      };
    }
    return { width: 0, height: 0 };
  }
}

// ── Default Vision Analyzer Implementation ──────────────────────────
export class DefaultVisionAnalyzer implements VisionAnalyzer {
  async analyzeImage(imageBuffer: Buffer, prompt?: string): Promise<{
    description: string;
    objects: string[];
    text: string[];
    sentiment: "positive" | "negative" | "neutral";
    confidence: number;
  }> {
    return {
      description: `Image with ${imageBuffer.length} bytes`,
      objects: [],
      text: [],
      sentiment: "neutral",
      confidence: imageBuffer.length > 0 ? 0.5 : 0
    };
  }

  async describeImage(imageBuffer: Buffer): Promise<string> {
    return `Image payload received (${imageBuffer.length} bytes)`;
  }

  async detectObjects(imageBuffer: Buffer): Promise<string[]> {
    // TODO: Implement object detection
    return [];
  }

  async extractText(imageBuffer: Buffer): Promise<string[]> {
    // TODO: Implement text extraction from images
    return [];
  }
}

// ── Default Audio Processor Implementation ──────────────────────────
export class DefaultAudioProcessor implements AudioProcessor {
  async transcribeAudio(audioBuffer: Buffer): Promise<{
    text: string;
    confidence: number;
    language: string;
  }> {
    const { createVoiceManager } = await import("../voice/tools.js");
    const voiceManager = createVoiceManager();
    await voiceManager.initialize();
    const result = await voiceManager.transcribeAudioBuffer(audioBuffer, "audio.wav");
    return {
      text: result.text,
      confidence: result.confidence || 0,
      language: result.language || "unknown"
    };
  }

  async generateSpeech(text: string, voice?: string): Promise<Buffer> {
    const { createVoiceManager } = await import("../voice/tools.js");
    const voiceManager = createVoiceManager();
    await voiceManager.initialize();
    if (voice) {
      voiceManager.updateTTSOptions({ voice });
    }
    const result = await voiceManager.synthesizeSpeech(text);
    return result.audioData;
  }

  async detectLanguage(audioBuffer: Buffer): Promise<string> {
    // TODO: Implement language detection
    return "unknown";
  }

  async getAudioDuration(audioBuffer: Buffer): Promise<number> {
    // TODO: Extract audio duration from file
    return 0;
  }
}

// ── File-based Media Storage Implementation ─────────────────────────
export class FileMediaStorage implements MediaStorage {
  private basePath: string;

  constructor(basePath: string = "./data/media") {
    this.basePath = basePath;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async store(buffer: Buffer, filename: string, metadata?: any): Promise<string> {
    const crypto = await import("crypto");

    const ext = path.extname(filename);
    const hash = crypto.createHash("md5").update(buffer).digest("hex").substring(0, 8);
    const uniqueFilename = `${hash}${ext}`;
    const filePath = path.join(this.basePath, uniqueFilename);

    // Write file
    fs.writeFileSync(filePath, buffer);

    // Store metadata if provided
    if (metadata) {
      const metadataPath = path.join(this.basePath, `${hash}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    // Return URL-like path
    return `file://${filePath}`;
  }

  async retrieve(url: string): Promise<Buffer> {
    const filePath = url.replace("file://", "");

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.readFileSync(filePath);
  }

  async delete(url: string): Promise<void> {
    const filePath = url.replace("file://", "");

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      // Also delete metadata file if exists
      const metadataPath = filePath.replace(path.extname(filePath), ".json");
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
    }
  }

  async getMetadata(url: string): Promise<any> {
    const filePath = url.replace("file://", "");
    const metadataPath = filePath.replace(path.extname(filePath), ".json");

    if (!fs.existsSync(metadataPath)) {
      return {};
    }

    const metadataContent = fs.readFileSync(metadataPath, "utf-8");
    return JSON.parse(metadataContent);
  }

  async list(prefix?: string): Promise<string[]> {
    const files = fs.readdirSync(this.basePath);
    const mediaFiles = files
      .filter((file: string) => {
        const ext = path.extname(file);
        return [".jpg", ".png", ".gif", ".mp3", ".wav", ".mp4", ".mov", ".pdf"].includes(ext);
      })
      .map((file: string) => `file://${path.join(this.basePath, file)}`);

    return mediaFiles;
  }
}

// ── Multi-modal Message Processor ───────────────────────────────────
export class MultiModalMessageProcessor {
  private mediaProcessor: MediaProcessor;
  private visionAnalyzer: VisionAnalyzer;
  private audioProcessor: AudioProcessor;
  private mediaStorage: MediaStorage;

  constructor(
    mediaProcessor?: MediaProcessor,
    visionAnalyzer?: VisionAnalyzer,
    audioProcessor?: AudioProcessor,
    mediaStorage?: MediaStorage
  ) {
    this.mediaProcessor = mediaProcessor || new DefaultMediaProcessor();
    this.visionAnalyzer = visionAnalyzer || new DefaultVisionAnalyzer();
    this.audioProcessor = audioProcessor || new DefaultAudioProcessor();
    this.mediaStorage = mediaStorage || new FileMediaStorage();
  }

  async processMessage(message: BaseMessage): Promise<MultiModalMessage> {
    const multiModalMessage: MultiModalMessage = {
      ...message,
      media: []
    };

    // Extract media attachments from message content if any
    // This would depend on how media is attached in the channel

    // Process any existing media attachments
    if (multiModalMessage.media && multiModalMessage.media.length > 0) {
      await this.processMediaAttachments(multiModalMessage);
    }

    return multiModalMessage;
  }

  private async processMediaAttachments(message: MultiModalMessage): Promise<void> {
    if (!message.media) return;

    for (const media of message.media) {
      try {
        switch (media.type) {
          case "image":
            if (media.buffer) {
              // Analyze image with vision
              message.visionAnalysis = await this.visionAnalyzer.describeImage(media.buffer);

              // Extract text from image
              const extractedText = await this.visionAnalyzer.extractText(media.buffer);
              if (extractedText.length > 0) {
                message.content += `\n\n[Image Text]: ${extractedText.join(" ")}`;
              }
            }
            break;

          case "audio":
            if (media.buffer && message.voiceMessage) {
              // Transcribe audio
              const transcription = await this.audioProcessor.transcribeAudio(media.buffer);
              message.transcription = transcription.text;
              message.content += `\n\n[Voice Message]: ${transcription.text}`;
            }
            break;

          case "video":
            if (media.buffer) {
              // Process video and generate thumbnail
              const processed = await this.mediaProcessor.processVideo(media.buffer, media.filename || "video");
              media.metadata = processed.metadata;

              // Analyze thumbnail
              message.visionAnalysis = await this.visionAnalyzer.describeImage(processed.thumbnail);
            }
            break;

          case "file":
            // Store file for future reference
            if (media.buffer) {
              const url = await this.mediaStorage.store(media.buffer, media.filename || "file", media.metadata);
              media.url = url;
            }
            break;
        }
      } catch (error) {
        logger.error(`[MultiModal] Error processing ${media.type}:`, error);
      }
    }
  }

  async generateResponseWithMedia(message: MultiModalMessage, response: string): Promise<{
    text: string;
    media?: MediaAttachment[];
  }> {
    const media: MediaAttachment[] = [];
    if (/\[attach:(https?:\/\/[^\]]+)\]/i.test(response)) {
      const match = response.match(/\[attach:(https?:\/\/[^\]]+)\]/i);
      if (match) {
        media.push({ type: "file", url: match[1] });
      }
    }

    return {
      text: response.replace(/\[attach:(https?:\/\/[^\]]+)\]/gi, "").trim(),
      media: media.length > 0 ? media : undefined
    };
  }

  // Utility methods
  async storeMedia(buffer: Buffer, filename: string, metadata?: any): Promise<string> {
    return this.mediaStorage.store(buffer, filename, metadata);
  }

  async retrieveMedia(url: string): Promise<Buffer> {
    return this.mediaStorage.retrieve(url);
  }

  async analyzeImage(buffer: Buffer): Promise<string> {
    return this.visionAnalyzer.describeImage(buffer);
  }

  async transcribeAudio(buffer: Buffer): Promise<string> {
    const result = await this.audioProcessor.transcribeAudio(buffer);
    return result.text;
  }
}

// ── Export default instances ────────────────────────────────────────
export const defaultMediaProcessor = new DefaultMediaProcessor();
export const defaultVisionAnalyzer = new DefaultVisionAnalyzer();
export const defaultAudioProcessor = new DefaultAudioProcessor();
export const defaultMediaStorage = new FileMediaStorage();
export const multiModalProcessor = new MultiModalMessageProcessor();
