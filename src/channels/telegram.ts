// ============================================================
// 🦀 Krab — Telegram Channel (OpenClaw-inspired)
// ============================================================
import { BaseChannel, ChannelConfig, BaseMessage, MediaAttachment, MultiModalMessage } from "./base.js";
import { multiModalProcessor } from "../multimodal/index.js";
import { logger } from "../utils/logger.js";

// ── Telegram Message Types ──────────────────────────────────────
interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
    username?: string;
  };
  text?: string;
  photo?: any;
  audio?: any;
  video?: any;
  document?: any;
  sticker?: any;
  reply_to_message?: TelegramMessage;
  forward_from?: any;
  entities?: Array<{
    type: string;
    offset?: number;
    length?: number;
    user?: any;
  }>;
}

// ── Telegram Channel Implementation ────────────────────────────────
export class TelegramChannel extends BaseChannel {
  private isRunning = false;

  constructor(config: ChannelConfig) {
    super("telegram", config);
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Telegram channel is not properly configured");
    }

    try {
      // TODO: Implement grammy integration
      // For now, just mark as running
      this.isRunning = true;
      logger.info("[Telegram] Channel started (placeholder implementation)");
      
    } catch (error) {
      logger.error("[Telegram] Failed to start channel:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
      logger.info("[Telegram] Channel stopped");
    }
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Telegram channel is not running");
    }

    try {
      // TODO: Implement actual Telegram API call
      logger.debug(`[Telegram] Would send message to ${recipient || "all"}: ${message}`);
      
    } catch (error) {
      logger.error("[Telegram] Failed to send message:", error);
      throw error;
    }
  }

  async sendImage(imageBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Telegram channel is not running");
    }

    try {
      // Process image before sending
      const processed = await multiModalProcessor.mediaProcessor.processImage(imageBuffer, filename);

      // TODO: Implement actual Telegram API call for photo
      logger.debug(`[Telegram] Would send image ${filename} (${processed.metadata.size} bytes) to ${recipient || "all"}`);

      if (caption) {
        logger.debug(`[Telegram] Image caption: ${caption}`);
      }

    } catch (error) {
      logger.error("[Telegram] Failed to send image:", error);
      throw error;
    }
  }

  async sendAudio(audioBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Telegram channel is not running");
    }

    try {
      // Process audio before sending
      const processed = await multiModalProcessor.mediaProcessor.processAudio(audioBuffer, filename);

      // TODO: Implement actual Telegram API call for audio
      logger.debug(`[Telegram] Would send audio ${filename} (${processed.metadata.duration}s) to ${recipient || "all"}`);

      if (caption) {
        logger.debug(`[Telegram] Audio caption: ${caption}`);
      }

      // Include transcription if available
      if (processed.transcription) {
        logger.debug(`[Telegram] Audio transcription: ${processed.transcription}`);
      }

    } catch (error) {
      logger.error("[Telegram] Failed to send audio:", error);
      throw error;
    }
  }

  async sendVideo(videoBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Telegram channel is not running");
    }

    try {
      // Process video before sending
      const processed = await multiModalProcessor.mediaProcessor.processVideo(videoBuffer, filename);

      // TODO: Implement actual Telegram API call for video
      logger.debug(`[Telegram] Would send video ${filename} (${processed.metadata.duration}s) to ${recipient || "all"}`);

      if (caption) {
        logger.debug(`[Telegram] Video caption: ${caption}`);
      }

    } catch (error) {
      logger.error("[Telegram] Failed to send video:", error);
      throw error;
    }
  }

  async sendFile(fileBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Telegram channel is not running");
    }

    try {
      // TODO: Implement actual Telegram API call for document
      logger.debug(`[Telegram] Would send file ${filename} (${fileBuffer.length} bytes) to ${recipient || "all"}`);

      if (caption) {
        logger.debug(`[Telegram] File caption: ${caption}`);
      }

    } catch (error) {
      logger.error("[Telegram] Failed to send file:", error);
      throw error;
    }
  }

  // Multi-modal channel interface
  supportsVoiceMessages(): boolean {
    return true; // Telegram supports voice messages
  }

  supportsVision(): boolean {
    return true; // Can analyze images sent to channel
  }

  async processVoiceMessage(audioBuffer: Buffer): Promise<{
    transcription: string;
    response: string;
  }> {
    try {
      const transcription = await multiModalProcessor.transcribeAudio(audioBuffer);
      // TODO: Generate response based on transcription
      const response = `I heard: "${transcription}"`;

      return {
        transcription,
        response
      };
    } catch (error) {
      logger.error("[Telegram] Failed to process voice message:", error);
      return {
        transcription: "",
        response: "Sorry, I couldn't process your voice message."
      };
    }
  }

  async analyzeImage(imageBuffer: Buffer): Promise<string> {
    try {
      return await multiModalProcessor.analyzeImage(imageBuffer);
    } catch (error) {
      logger.error("[Telegram] Failed to analyze image:", error);
      return "Sorry, I couldn't analyze this image.";
    }
  }

  getMediaLimits() {
    return {
      maxImageSize: 10 * 1024 * 1024, // 10MB
      maxAudioSize: 20 * 1024 * 1024, // 20MB
      maxVideoSize: 50 * 1024 * 1024, // 50MB
      maxFileSize: 20 * 1024 * 1024,  // 20MB
      supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      supportedAudioTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4"],
      supportedVideoTypes: ["video/mp4", "video/avi", "video/mov"],
      supportedFileTypes: ["*/*"] // All file types
    };
  }

  isConfigured(): boolean {
    return !!this.getBotToken();
  }

  // Implement handleWebhook for webhook-based message handling
  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      // For Telegram, webhooks are typically handled by the bot library
      // This is a placeholder for future webhook implementation
      logger.debug("[Telegram] Webhook received (placeholder)");
      res.status(200).send("OK");
    } catch (error) {
      logger.error("[Telegram] Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  // ── Private Methods ───────────────────────────────────────────
  private getBotToken(): string | undefined {
    // Check config first, then environment
    if (this.config.botToken) {
      return this.config.botToken;
    }
    
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  private convertToBaseMessage(telegramMsg: TelegramMessage): BaseMessage {
    const mentions = this.extractMentions(telegramMsg.text || "");
    
    return {
      id: telegramMsg.message_id.toString(),
      timestamp: new Date(),
      sender: {
        id: telegramMsg.from.id.toString(),
        username: telegramMsg.from.username,
        displayName: `${telegramMsg.from.first_name} ${telegramMsg.from.last_name || ""}`.trim(),
      },
      channel: "telegram",
      content: telegramMsg.text || "",
      type: this.getMessageType(telegramMsg),
      metadata: {
        groupId: telegramMsg.chat.type !== "private" ? telegramMsg.chat.id.toString() : undefined,
        groupName: telegramMsg.chat.title,
        replyTo: telegramMsg.reply_to_message?.message_id.toString(),
        forwardFrom: telegramMsg.forward_from?.id.toString(),
        mentions,
      },
    };
  }

  private getMessageType(telegramMsg: TelegramMessage): BaseMessage["type"] {
    if (telegramMsg.text) return "text";
    if (telegramMsg.photo) return "image";
    if (telegramMsg.audio) return "audio";
    if (telegramMsg.video) return "video";
    if (telegramMsg.document) return "file";
    if (telegramMsg.sticker) return "sticker";
    return "text";
  }

  protected extractMentions(content: string): string[] {
    const mentions: string[] = [];
    
    // Extract @mentions from entities
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);
    
    if (matches) {
      mentions.push(...matches);
    }
    
    return mentions;
  }

  protected formatResponse(response: string, originalMessage?: BaseMessage): string {
    // Telegram supports Markdown formatting
    return response;
  }

  // ── Telegram-specific Methods ─────────────────────────────────
  async getBotInfo(): Promise<any> {
    // TODO: Implement actual Telegram API call
    if (!this.isRunning) {
      throw new Error("Channel is not running");
    }
    
    return { username: "placeholder_bot" };
  }

  async setCommands(commands: Array<{ command: string; description: string }>): Promise<void> {
    // TODO: Implement actual Telegram API call
    if (!this.isRunning) {
      throw new Error("Channel is not running");
    }
    
    logger.info("[Telegram] Bot commands updated (placeholder)");
  }
}

// ── Register Channel ───────────────────────────────────────────
export function registerTelegramChannel(): void {
  logger.info("[Telegram] Channel registration ready");
}

export default TelegramChannel;
