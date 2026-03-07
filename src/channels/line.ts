// ============================================================
// 🦀 Krab — LINE Channel (OpenClaw-inspired)
// ============================================================
import {
  BaseChannel,
  ChannelConfig,
  BaseMessage,
  MediaAttachment,
  MultiModalMessage,
} from "./base.js";
import { defaultMediaProcessor, multiModalProcessor } from "../multimodal/index.js";
import { logger } from "../utils/logger.js";
import { createHmac, timingSafeEqual } from "crypto";
import * as fs from "fs";
import * as path from "path";

// ── LINE Message Types ────────────────────────────────────────
interface LINEMessage {
  events: Array<{
    type: string;
    timestamp: number;
    source: {
      type: "user" | "group" | "room";
      userId?: string;
      groupId?: string;
      roomId?: string;
    };
    message: {
      id: string;
      type: "text" | "image" | "audio" | "video" | "file" | "sticker";
      text?: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
      contentProvider?: {
        type: string;
        originalContentUrl: string;
        previewImageUrl: string;
      };
    };
    replyToken?: string;
    webhookEventId?: string;
    deliveryContext?: {
      isRedelivery: boolean;
    };
  }>;
}

// ── LINE Channel Implementation ──────────────────────────────────
export class LINEChannel extends BaseChannel {
  private isRunning = false;
  private webhookUrl?: string;

  constructor(config: ChannelConfig) {
    super("line", config);
    this.webhookUrl = config.webhookPath || "/line/webhook";
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("LINE channel is not properly configured");
    }

    try {
      await this.getBotInfo();
      this.isRunning = true;
      logger.info("[LINE] Channel started");
      logger.info(`[LINE] Webhook path: ${this.webhookUrl}`);
    } catch (error) {
      logger.error("[LINE] Failed to start channel:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
      logger.info("[LINE] Channel stopped");
    }
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("LINE channel is not running");
    }
    if (!recipient) {
      throw new Error("LINE recipient user/group ID is required");
    }

    try {
      await this.callLinePush(recipient, [
        { type: "text", text: message }
      ]);
    } catch (error) {
      logger.error("[LINE] Failed to send message:", error);
      throw error;
    }
  }

  async sendFile(
    file: Buffer | string,
    filename: string,
    recipient?: string,
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error("LINE channel is not running");
    }

    try {
      const maxSize = (this.config.mediaMaxMb || 10) * 1024 * 1024;
      if (typeof file === "string") {
      } else if (file.length > maxSize) {
        throw new Error(
          `File size exceeds limit of ${this.config.mediaMaxMb || 10}MB`,
        );
      }

      const url = this.ensurePublicMediaUrl(file, filename);
      await this.callLinePush(recipient, [{
        type: "file",
        originalContentUrl: url,
        fileName: filename
      }]);
    } catch (error) {
      logger.error("[LINE] Failed to send file:", error);
      throw error;
    }
  }

  async sendImage(
    imageBuffer: Buffer,
    filename: string,
    caption?: string,
    recipient?: string,
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error("LINE channel is not running");
    }

    try {
      // Process image before sending
      const processed = await defaultMediaProcessor.processImage(
        imageBuffer,
        filename,
      );

      // Check size limit (LINE allows up to 10MB)
      const maxSize = this.getMediaLimits().maxImageSize;
      if (processed.buffer.length > maxSize) {
        throw new Error(
          `Image size exceeds LINE limit of ${maxSize / (1024 * 1024)}MB`,
        );
      }

      const url = this.ensurePublicMediaUrl(processed.buffer, filename);
      await this.callLinePush(recipient, [
        {
          type: "image",
          originalContentUrl: url,
          previewImageUrl: url
        }
      ]);

      if (caption) {
        await this.callLinePush(recipient, [{ type: "text", text: caption }]);
      }
    } catch (error) {
      logger.error("[LINE] Failed to send image:", error);
      throw error;
    }
  }

  async sendAudio(
    audioBuffer: Buffer,
    filename: string,
    caption?: string,
    recipient?: string,
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error("LINE channel is not running");
    }

    try {
      // Process audio before sending
      const processed = await defaultMediaProcessor.processAudio(
        audioBuffer,
        filename,
      );

      // Check size limit
      const maxSize = this.getMediaLimits().maxAudioSize;
      if (processed.buffer.length > maxSize) {
        throw new Error(
          `Audio size exceeds LINE limit of ${maxSize / (1024 * 1024)}MB`,
        );
      }

      const url = this.ensurePublicMediaUrl(processed.buffer, filename);
      await this.callLinePush(recipient, [
        {
          type: "audio",
          originalContentUrl: url,
          duration: Math.max(1000, Math.round((processed.metadata.duration || 1) * 1000))
        }
      ]);

      if (caption) {
        await this.callLinePush(recipient, [{ type: "text", text: caption }]);
      }
    } catch (error) {
      logger.error("[LINE] Failed to send audio:", error);
      throw error;
    }
  }

  async sendVideo(
    videoBuffer: Buffer,
    filename: string,
    caption?: string,
    recipient?: string,
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error("LINE channel is not running");
    }

    try {
      // Process video before sending
      const processed = await defaultMediaProcessor.processVideo(
        videoBuffer,
        filename,
      );

      // Check size limit
      const maxSize = this.getMediaLimits().maxVideoSize;
      if (processed.buffer.length > maxSize) {
        throw new Error(
          `Video size exceeds LINE limit of ${maxSize / (1024 * 1024)}MB`,
        );
      }

      const url = this.ensurePublicMediaUrl(processed.buffer, filename);
      await this.callLinePush(recipient, [
        {
          type: "video",
          originalContentUrl: url,
          previewImageUrl: url
        }
      ]);

      if (caption) {
        await this.callLinePush(recipient, [{ type: "text", text: caption }]);
      }
    } catch (error) {
      logger.error("[LINE] Failed to send video:", error);
      throw error;
    }
  }

  // Multi-modal channel interface
  supportsVoiceMessages(): boolean {
    return false; // LINE doesn't have native voice messages, but can send audio
  }

  supportsVision(): boolean {
    return true; // Can analyze images sent to channel
  }

  async transcribeVoiceMessage(audioBuffer: Buffer): Promise<{
    transcription: string;
    response: string;
  }> {
    try {
      const transcription =
        await multiModalProcessor.transcribeAudio(audioBuffer);
      const response = `I heard: "${transcription}"`;

      return {
        transcription,
        response,
      };
    } catch (error) {
      logger.error("[LINE] Failed to process voice message:", error);
      return {
        transcription: "",
        response: "Sorry, I couldn't process your voice message.",
      };
    }
  }

  async analyzeImageBuffer(imageBuffer: Buffer): Promise<string> {
    try {
      return await multiModalProcessor.analyzeImage(imageBuffer);
    } catch (error) {
      logger.error("[LINE] Failed to analyze image:", error);
      return "Sorry, I couldn't analyze this image.";
    }
  }

  getMediaLimits() {
    return {
      maxImageSize: 10 * 1024 * 1024, // 10MB
      maxAudioSize: 100 * 1024 * 1024, // 100MB
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedImageTypes: ["image/jpeg", "image/png"],
      supportedAudioTypes: [
        "audio/m4a",
        "audio/mp3",
        "audio/aac",
        "audio/amr",
        "audio/wav",
      ],
      supportedVideoTypes: ["video/mp4"],
      supportedFileTypes: ["*/*"], // All file types up to size limit
    };
  }

  isConfigured(): boolean {
    return !!(this.getChannelAccessToken() && this.getChannelSecret());
  }

  // Implement handleWebhook for LINE webhook processing
  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      const signature = req.headers["x-line-signature"];
      const body = req.body;

      if (!this.verifySignature(body, signature)) {
        res.status(401).send("Invalid signature");
        return;
      }

      if (body && body.events) {
        for (const event of body.events) {
          const baseMessage = this.convertToBaseMessage(event);
          await this.processIncomingMessage(baseMessage);
        }
      }

      // Send 200 OK response
      res.status(200).send("OK");
    } catch (error) {
      logger.error("[LINE] Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  // ── Private Methods ───────────────────────────────────────────
  private getChannelAccessToken(): string | undefined {
    // Check config first, then environment
    if (this.config.channelAccessToken) {
      return this.config.channelAccessToken;
    }

    return process.env.LINE_CHANNEL_ACCESS_TOKEN;
  }

  private getChannelSecret(): string | undefined {
    // Check config first, then environment
    if (this.config.channelSecret) {
      return this.config.channelSecret;
    }

    return process.env.LINE_CHANNEL_SECRET;
  }

  private async handleLINEWebhook(body: any, signature: string): Promise<void> {
    try {
      if (!this.verifySignature(body, signature)) {
        throw new Error("Invalid LINE webhook signature");
      }
      const lineMsg = body as LINEMessage;

      for (const event of lineMsg.events) {
        const baseMessage = this.convertToBaseMessage(event);
        await this.processIncomingMessage(baseMessage);
      }
    } catch (error) {
      logger.error("[LINE] Error handling webhook:", error);
    }
  }

  private convertToBaseMessage(event: any): BaseMessage {
    const mentions = this.extractMentions(event.message?.text || "");

    return {
      id: event.message?.id || event.webhookEventId || "",
      timestamp: new Date(event.timestamp),
      sender: {
        id:
          event.source.userId ||
          event.source.groupId ||
          event.source.roomId ||
          "",
        displayName: this.getDisplayName(event.source),
      },
      channel: "line",
      content: event.message?.text || "",
      type: this.getMessageType(event.message?.type || "text"),
      metadata: {
        groupId: event.source.groupId || event.source.roomId,
        replyTo: event.replyToken,
        mentions,
      },
    };
  }

  private getMessageType(lineType: string): BaseMessage["type"] {
    const typeMap: Record<string, BaseMessage["type"]> = {
      text: "text",
      image: "image",
      audio: "audio",
      video: "video",
      file: "file",
      sticker: "sticker",
    };

    return typeMap[lineType] || "text";
  }

  private getDisplayName(source: any): string {
    // For LINE, we'd need to fetch user profile
    // For now, return the ID
    return source.userId || source.groupId || source.roomId || "Unknown";
  }

  protected extractMentions(content: string): string[] {
    const mentions: string[] = [];

    // LINE uses @mentions similar to other platforms
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);

    if (matches) {
      mentions.push(...matches);
    }

    return mentions;
  }

  protected formatResponse(
    response: string,
    originalMessage?: BaseMessage,
  ): string {
    // LINE has specific formatting rules:
    // - Markdown is stripped
    // - Code blocks and tables converted to Flex cards
    // For now, return plain text
    return response;
  }

  // ── LINE-specific Methods ───────────────────────────────────
  async getBotInfo(): Promise<any> {
    if (!this.isRunning) {
      const response = await fetch("https://api.line.me/v2/bot/info", {
        headers: {
          Authorization: `Bearer ${this.getChannelAccessToken()}`
        }
      });
      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch LINE bot info");
      }
      return data;
    }

    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: {
        Authorization: `Bearer ${this.getChannelAccessToken()}`
      }
    });
    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Failed to fetch LINE bot info");
    }
    return data;
  }

  private verifySignature(body: any, signatureHeader: string | string[] | undefined): boolean {
    const secret = this.getChannelSecret();
    if (!secret || !signatureHeader || Array.isArray(signatureHeader)) {
      return false;
    }

    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const expected = createHmac("sha256", secret).update(payload).digest("base64");

    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  }

  private async callLinePush(recipient: string | undefined, messages: any[]): Promise<void> {
    if (!recipient) {
      throw new Error("LINE recipient user/group ID is required");
    }

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getChannelAccessToken()}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        to: recipient,
        messages
      })
    });

    if (!response.ok) {
      const data: any = await response.json().catch(() => ({}));
      throw new Error(data?.message || "LINE push message failed");
    }
  }

  private ensurePublicMediaUrl(file: Buffer | string, filename: string): string {
    if (typeof file === "string") {
      return file;
    }

    const publicBaseUrl = process.env.KRAB_PUBLIC_BASE_URL;
    if (!publicBaseUrl) {
      throw new Error(
        `LINE requires KRAB_PUBLIC_BASE_URL to expose uploaded media for ${filename}.`,
      );
    }

    const mediaDir = path.join(process.cwd(), "generated-images", "line-media");
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const outputPath = path.join(mediaDir, safeName);
    fs.writeFileSync(outputPath, file);

    return `${publicBaseUrl.replace(/\/$/, "")}/generated-images/line-media/${safeName}`;
  }
}

// ── Register Channel ───────────────────────────────────────────
export function registerLINEChannel(): void {
  logger.info("[LINE] Channel registration ready");
}
