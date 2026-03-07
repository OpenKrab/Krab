// ============================================================
// 🦀 Krab — iMessage Channel (BlueBubbles or macOS Native)
// ============================================================
import { BaseChannel, ChannelConfig, BaseMessage, MediaAttachment, MultiModalMessage } from "./base.js";
import { multiModalProcessor } from "../multimodal/index.js";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let axios: any = null;

// ── iMessage Message Types ───────────────────────────────────
interface iMessage {
  guid: string;
  text: string;
  subject?: string;
  isFromMe: boolean;
  dateCreated: number;
  dateDelivered?: number;
  dateRead?: number;
  handleId: string;
  handle?: string;
  groupId?: string;
  groupName?: string;
  attachments?: Array<{
    guid: string;
    filename: string;
    mimeType: string;
    size: number;
    path?: string;
  }>;
  isSticker?: boolean;
  isAudioMessage?: boolean;
}

interface iMessageHandle {
  id: string;
  originalHandle?: string;
  service: string; // "iMessage", "SMS", "FaceTime"
}

// ── iMessage Channel Implementation ───────────────────────────
export class iMessageChannel extends BaseChannel {
  private isConnected = false;
  private baseUrl: string = "";
  private apiToken: string = "";

  constructor(config: ChannelConfig) {
    super("imessage", config);
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("iMessage channel is not properly configured");
    }

    try {
      this.baseUrl = this.getBaseUrl();
      this.apiToken = this.getApiToken();

      // Test connection to BlueBubbles server
      await this.testConnection();
      
      this.isConnected = true;
      logger.info(`[iMessage] Channel started: ${this.baseUrl}`);
    } catch (error) {
      logger.error("[iMessage] Failed to start channel:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isConnected = false;
    logger.info("[iMessage] Channel stopped");
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error("iMessage channel is not connected");
    }

    if (!recipient) {
      throw new Error("iMessage recipient is required");
    }

    try {
      // BlueBubbles API format
      const response = await axios.post(`${this.baseUrl}/api/v1/messages`, {
        method: "send",
        to: recipient,
        message: message,
        service: "iMessage"
      }, {
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to send message");
      }
    } catch (error) {
      logger.error("[iMessage] Failed to send message:", error);
      throw error;
    }
  }

  async sendFile(file: Buffer | string, filename: string, recipient?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error("iMessage channel is not connected");
    }

    if (!recipient) {
      throw new Error("iMessage recipient is required");
    }

    try {
      // For BlueBubbles, we'd need to upload the file first
      // Then send the message with the attachment GUID
      logger.warn("[iMessage] File sending requires additional setup with BlueBubbles");
      
      // For now, just send the filename as text
      await this.sendMessage(`[File: ${filename}]`, recipient);
    } catch (error) {
      logger.error("[iMessage] Failed to send file:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(this.getBaseUrl() && this.getApiToken());
  }

  // ── iMessage-specific Methods ─────────────────────────────────
  private getBaseUrl(): string {
    if (this.config.webhookUrl) {
      return this.config.webhookUrl;
    }
    return process.env.IMESSAGE_API_URL || "http://localhost:1234";
  }

  private getApiToken(): string {
    if (this.config.botToken) {
      return this.config.botToken;
    }
    return process.env.IMESSAGE_API_TOKEN || "";
  }

  private async testConnection(): Promise<void> {
    const axiosModule = await import("axios").catch(() => null);
    if (!axiosModule) {
      throw new Error("Axios not installed. Run: npm install axios");
    }
    axios = axiosModule.default;

    const response = await axios.get(`${this.baseUrl}/api/v1/me`, {
      headers: {
        "Authorization": `Bearer ${this.apiToken}`
      }
    });

    if (!response.data?.success) {
      throw new Error("Failed to connect to BlueBubbles server");
    }

    logger.info(`[iMessage] Connected as: ${response.data?.data?.name || "unknown"}`);
  }

  // ── Webhook Handler (for BlueBubbles webhooks) ─────────────
  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      const message = req.body;
      
      if (!message) {
        res.status(200).send("OK");
        return;
      }

      // Handle new message notification
      if (message.type === "new-message" || message.guid) {
        const baseMessage = this.convertIMessageToMessage(message);
        
        // Only process incoming messages (not sent by us)
        if (!baseMessage.metadata?.isFromMe) {
          await this.processIncomingMessage(baseMessage);
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("[iMessage] Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  private convertIMessageToMessage(msg: any): BaseMessage {
    return {
      id: msg.guid || `im_${Date.now()}`,
      timestamp: new Date(msg.dateCreated * 1000),
      sender: {
        id: msg.handle || msg.handleId || "unknown",
        username: msg.handle
      },
      channel: "imessage",
      content: msg.text || "",
      type: msg.isSticker ? "sticker" : (msg.isAudioMessage ? "audio" : "text"),
      metadata: {
        groupId: msg.groupId,
        groupName: msg.groupName,
        isFromMe: msg.isFromMe
      }
    };
  }

  // ── Multi-modal Interface Implementation ────────────────────
  supportsVoiceMessages(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return true;
  }

  async transcribeVoiceMessage(audioBuffer: Buffer): Promise<{
    transcription: string;
    response: string;
  }> {
    try {
      const transcription = await multiModalProcessor.transcribeAudio(audioBuffer);
      const response = `I heard: "${transcription}"`;

      return {
        transcription,
        response
      };
    } catch (error) {
      logger.error("[iMessage] Failed to process voice message:", error);
      return {
        transcription: "",
        response: "Sorry, I couldn't process your voice message."
      };
    }
  }

  async analyzeImageBuffer(imageBuffer: Buffer): Promise<string> {
    try {
      return await multiModalProcessor.analyzeImage(imageBuffer);
    } catch (error) {
      logger.error("[iMessage] Failed to analyze image:", error);
      return "Sorry, I couldn't analyze this image.";
    }
  }

  getMediaLimits() {
    return {
      maxImageSize: 100 * 1024 * 1024, // 100MB (via BlueBubbles)
      maxAudioSize: 100 * 1024 * 1024, // 100MB
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/heic"],
      supportedAudioTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/m4a"],
      supportedVideoTypes: ["video/mp4", "video/quicktime"],
      supportedFileTypes: ["*/*"]
    };
  }

  // ── iMessage-specific Methods ─────────────────────────────────
  async getChats(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/chats`, {
        headers: {
          "Authorization": `Bearer ${this.apiToken}`
        }
      });
      return response.data?.data || [];
    } catch (error) {
      logger.error("[iMessage] Failed to get chats:", error);
      return [];
    }
  }

  async getMessages(chatGuid: string, limit = 50): Promise<iMessage[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/chats/${chatGuid}/messages`, {
        headers: {
          "Authorization": `Bearer ${this.apiToken}`
        },
        params: { limit }
      });
      return response.data?.data || [];
    } catch (error) {
      logger.error("[iMessage] Failed to get messages:", error);
      return [];
    }
  }

  async markAsRead(chatGuid: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/v1/chats/${chatGuid}/read`, {}, {
        headers: {
          "Authorization": `Bearer ${this.apiToken}`
        }
      });
    } catch (error) {
      logger.warn("[iMessage] Failed to mark as read:", error);
    }
  }
}

// ── Register Channel ───────────────────────────────────────────
export function registeriMessageChannel(): void {
  logger.info("[iMessage] Channel registration ready");
}

export default iMessageChannel;
