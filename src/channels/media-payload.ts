// ============================================================
// 🦀 Krab — Media Payloads
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export const MediaPayloadSchema = z.object({
  type: z.enum(["image", "audio", "video", "file", "sticker"]),
  url: z.string().url().optional(),
  data: z.string().base64().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  thumbnail: z.string().optional(),
  metadata: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
    format: z.string().optional(),
  }).optional(),
});

export type MediaPayload = z.infer<typeof MediaPayloadSchema>;

export interface MediaLimits {
  maxSizeBytes: number;
  maxDurationSeconds?: number;
  allowedTypes: string[];
  allowedFormats: string[];
}

export const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxSizeBytes: 25 * 1024 * 1024, // 25MB
  maxDurationSeconds: 300, // 5 minutes
  allowedTypes: ["image", "audio", "video", "file"],
  allowedFormats: ["jpg", "jpeg", "png", "gif", "webp", "mp3", "wav", "ogg", "mp4", "mov", "pdf", "txt"],
};

export class MediaPayloadProcessor {
  private limits: MediaLimits;
  private tempDir: string;

  constructor(limits: Partial<MediaLimits> = {}, tempDir?: string) {
    this.limits = { ...DEFAULT_MEDIA_LIMITS, ...limits };
    this.tempDir = tempDir || path.join(process.cwd(), ".krab", "media");
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  validate(payload: MediaPayload): { valid: boolean; error?: string } {
    if (!this.limits.allowedTypes.includes(payload.type)) {
      return { valid: false, error: `Media type ${payload.type} not allowed` };
    }

    if (payload.size && payload.size > this.limits.maxSizeBytes) {
      return { valid: false, error: `File size exceeds limit of ${this.limits.maxSizeBytes} bytes` };
    }

    if (payload.metadata?.duration && this.limits.maxDurationSeconds) {
      if (payload.metadata.duration > this.limits.maxDurationSeconds) {
        return { valid: false, error: `Duration exceeds limit of ${this.limits.maxDurationSeconds}s` };
      }
    }

    return { valid: true };
  }

  async processIncoming(payload: MediaPayload): Promise<MediaPayload> {
    if (payload.url && !payload.data) {
      try {
        const response = await fetch(payload.url);
        const buffer = await response.arrayBuffer();
        
        return {
          ...payload,
          data: Buffer.from(buffer).toString("base64"),
          size: buffer.byteLength,
        };
      } catch (error) {
        logger.error(`[MediaPayload] Failed to fetch media:`, error);
        throw new Error("Failed to download media");
      }
    }

    return payload;
  }

  async saveTemp(payload: MediaPayload): Promise<string> {
    const ext = this.getExtension(payload);
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(this.tempDir, filename);

    if (payload.data) {
      fs.writeFileSync(filepath, Buffer.from(payload.data, "base64"));
    } else if (payload.url) {
      const response = await fetch(payload.url);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filepath, Buffer.from(buffer));
    }

    logger.debug(`[MediaPayload] Saved to: ${filepath}`);
    return filepath;
  }

  cleanup(filepath: string): void {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.debug(`[MediaPayload] Cleaned up: ${filepath}`);
      }
    } catch (error) {
      logger.warn(`[MediaPayload] Failed to cleanup: ${filepath}`);
    }
  }

  private getExtension(payload: MediaPayload): string {
    if (payload.filename) {
      const ext = path.extname(payload.filename).slice(1);
      if (ext) return ext;
    }

    if (payload.mimeType) {
      const mimeToExt: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "video/mp4": "mp4",
      };
      return mimeToExt[payload.mimeType] || "bin";
    }

    return "bin";
  }

  setLimits(limits: Partial<MediaLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  getLimits(): MediaLimits {
    return { ...this.limits };
  }
}

// ── Media Upload Handler ─────────────────────────────────────────

export interface UploadResult {
  url: string;
  mediaId?: string;
  thumbnailUrl?: string;
}

export abstract class MediaUploader {
  protected abstract upload(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<UploadResult>;

  async uploadPayload(payload: MediaPayload): Promise<UploadResult> {
    let buffer: Buffer;

    if (payload.data) {
      buffer = Buffer.from(payload.data, "base64");
    } else if (payload.url) {
      const response = await fetch(payload.url);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error("No media data or URL provided");
    }

    const filename = payload.filename || `media_${Date.now()}`;
    const mimeType = payload.mimeType || this.guessMimeType(filename);

    return this.upload(buffer, filename, mimeType);
  }

  protected guessMimeType(filename: string): string {
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      mp4: "video/mp4",
      mov: "video/quicktime",
      pdf: "application/pdf",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}
