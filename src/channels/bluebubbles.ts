// ============================================================
// 🦀 Krab — iMessage/BlueBubbles Channel Adapter
// OpenClaw-inspired plugin-based channel for iMessage via BlueBubbles
// ============================================================
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { BaseChannel, type ChannelConfig, type ChannelCapabilities, type MultiModalMessage, type BaseMessage } from "./base.js";

const BlueBubblesConfigSchema = z.object({
  enabled: z.boolean(),
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).default("pairing"),
  groupPolicy: z.enum(["open", "disabled", "allowlist"]).default("disabled"),
  serverUrl: z.string().url(),
  password: z.string(),
  webhookPath: z.string().default("/bluebubbles/webhook"),
  actions: z.object({
    reactions: z.boolean().default(true),
    typing: z.boolean().default(true),
    readReceipts: z.boolean().default(true),
  }).optional(),
});

type BlueBubblesConfig = z.infer<typeof BlueBubblesConfigSchema>;

const CAPABILITIES: ChannelCapabilities = {
  polls: false,
  reactions: true,
  edit: false,
  unsend: false,
  reply: true,
  effects: false,
  groupManagement: false,
  threads: false,
  media: true,
  nativeCommands: false,
  buttons: false,
  carousels: false,
  voiceMessages: true,
};

interface BlueBubblesMessage {
  id: string;
  text: string;
  sender: string;
  chatGUID: string;
  dateCreated: number;
  isFromMe: boolean;
  hasAttachments: boolean;
  attachments?: Array<{
    guid: string;
    mimeType: string;
    fileName: string;
    transferName: string;
    totalBytes: number;
  }>;
}

interface BlueBubblesChat {
  guid: string;
  displayName: string;
  participants: string[];
}

export class BlueBubblesChannel extends BaseChannel {
  private bbConfig: BlueBubblesConfig;
  private serverUrl: string;
  private password: string;
  private connected = false;

  constructor(config: ChannelConfig) {
    const parsed = BlueBubblesConfigSchema.parse(config);
    super("bluebubbles", config);
    this.bbConfig = parsed;
    this.serverUrl = parsed.serverUrl.replace(/\/$/, "");
    this.password = parsed.password;
  }

  getCapabilities(): ChannelCapabilities {
    return CAPABILITIES;
  }

  isConfigured(): boolean {
    return !!(this.bbConfig.serverUrl && this.bbConfig.password);
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("BlueBubbles not configured");
    }

    const health = await this.probeServer();
    if (!health) {
      throw new Error("BlueBubbles server not responding");
    }

    this.connected = true;
    logger.info("[BlueBubbles] Channel started");
  }

  async stop(): Promise<void> {
    this.connected = false;
    logger.info("[BlueBubbles] Channel stopped");
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!recipient) {
      throw new Error("Recipient required for BlueBubbles");
    }

    const chatGuid = await this.resolveChatGuid(recipient);
    await this.sendMessageToChat(chatGuid, message);
  }

  async sendFile(file: Buffer | string, filename: string, recipient?: string): Promise<void> {
    if (!recipient) {
      throw new Error("Recipient required for BlueBubbles");
    }

    const chatGuid = await this.resolveChatGuid(recipient);
    await this.sendAttachment(chatGuid, file, filename);
  }

  private async probeServer(): Promise<boolean> {
    try {
      const response = await this.fetch("/api/health", "GET");
      return response?.data?.status === "OK";
    } catch {
      return false;
    }
  }

  private async fetch(path: string, method: string, body?: unknown): Promise<any> {
    const url = `${this.serverUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.password}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`BlueBubbles API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async resolveChatGuid(target: string): Promise<string> {
    const chats = await this.fetch("/api/chat?q=" + encodeURIComponent(target), "GET");
    
    if (chats?.data?.length > 0) {
      return chats.data[0].guid;
    }

    const numericTarget = target.replace(/\D/g, "");
    return `iMessage;+${numericTarget}@chat.apple.com`;
  }

  private async sendMessageToChat(chatGuid: string, text: string): Promise<void> {
    await this.fetch("/api/message", "POST", {
      chatGuid,
      text,
    });
  }

  private async sendAttachment(chatGuid: string, file: Buffer | string, filename: string): Promise<void> {
    const formData = new FormData();
    
    if (typeof file === "string") {
      const response = await fetch(file);
      file = Buffer.from(await response.arrayBuffer());
    }
    
    formData.append("file", new Blob([new Uint8Array(file)]), filename);
    formData.append("chatGuid", chatGuid);

    const response = await fetch(`${this.serverUrl}/api/attachment`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.password}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to send attachment: ${response.statusText}`);
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    const message = this.normalizeWebhookMessage(payload);
    
    const isFromMe = (payload as BlueBubblesMessage).isFromMe;
    if (isFromMe) {
      return;
    }

    await this.processIncomingMessage(message);
  }

  private normalizeWebhookMessage(payload: any): MultiModalMessage {
    const msg = payload as BlueBubblesMessage;
    
    const channelMessage: MultiModalMessage = {
      id: msg.id,
      timestamp: new Date(msg.dateCreated),
      sender: {
        id: msg.sender,
        displayName: msg.sender,
      },
      channel: "bluebubbles",
      content: msg.text || "",
      type: msg.hasAttachments ? "image" : "text",
      metadata: {
        groupId: msg.chatGUID,
      },
    };

    if (msg.hasAttachments && msg.attachments) {
      channelMessage.media = msg.attachments.map(att => ({
        type: this.getMediaType(att.mimeType),
        url: `${this.serverUrl}/api/attachment/${att.guid}/download`,
        filename: att.fileName || att.transferName,
        mimeType: att.mimeType,
        size: att.totalBytes,
      }));
    }

    return channelMessage;
  }

  private getMediaType(mimeType: string): "image" | "audio" | "video" | "file" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "file";
  }

  async addReaction(messageId: string, emoji: string, channelId: string): Promise<void> {
    if (!this.bbConfig.actions?.reactions) {
      throw new Error("Reactions not enabled");
    }

    const tapback = this.emojiToTapback(emoji);
    await this.fetch("/api/tapback", "POST", {
      messageId,
      tapback,
      chatGuid: channelId,
    });
  }

  async sendTyping(chatGuid: string): Promise<void> {
    if (!this.bbConfig.actions?.typing) return;

    await this.fetch("/api/typing", "POST", {
      chatGuid,
    });
  }

  async markRead(chatGuid: string, messageId: string): Promise<void> {
    if (!this.bbConfig.actions?.readReceipts) return;

    await this.fetch("/api/read", "POST", {
      chatGuid,
      messageId,
    });
  }

  private emojiToTapback(emoji: string): number {
    const map: Record<string, number> = {
      "❤️": 1,
      "👍": 2,
      "👎": 3,
      "😂": 4,
      "😮": 5,
      "😢": 6,
      "🙏": 7,
    };
    return map[emoji] || 1;
  }

  async listChats(): Promise<{ id: string; name: string; participants: string[] }[]> {
    const response = await this.fetch("/api/chat", "GET");
    return response.data.map((chat: BlueBubblesChat) => ({
      id: chat.guid,
      name: chat.displayName,
      participants: chat.participants,
    }));
  }
}

export function registerBlueBubblesChannel(): void {
  const { ChannelFactory } = require("./base.js");
  ChannelFactory.register("bluebubbles", BlueBubblesChannel);
}
