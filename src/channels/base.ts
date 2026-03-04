// ============================================================
// 🦀 Krab — Channel Base Interface (OpenClaw-inspired)
// ============================================================
import { z } from "zod";
import { logger } from "../utils/logger.js";

// ── Message Types ──────────────────────────────────────────────
export interface BaseMessage {
  id: string;
  timestamp: Date;
  sender: {
    id: string;
    username?: string;
    displayName?: string;
  };
  channel: string;
  content: string;
  type: "text" | "image" | "audio" | "video" | "file" | "sticker";
  metadata?: {
    replyTo?: string;
    forwardFrom?: string;
    mentions?: string[];
    groupId?: string;
    groupName?: string;
  };
}

// ── Multi-modal Support ───────────────────────────────────────────
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
  transcriptionConfidence?: number;
  voiceReply?: boolean;
  voiceReplyVoice?: string;
}

export interface ChannelConfig {
  enabled: boolean;
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled";
  groupPolicy: "open" | "disabled" | "allowlist";
  allowFrom?: string[];
  groupAllowFrom?: string[];
  groups?: Record<string, GroupConfig>;
  // Channel-specific properties
  botToken?: string;
  channelAccessToken?: string;
  channelSecret?: string;
  webhookPath?: string;
  mediaMaxMb?: number;
}

export interface GroupConfig {
  requireMention?: boolean;
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  toolsBySender?: Record<string, {
    allow?: string[];
    deny?: string[];
    alsoAllow?: string[];
  }>;
  historyLimit?: number;
}

// ── Base Channel Interface ────────────────────────────────────────
export abstract class BaseChannel {
  protected config: ChannelConfig;
  protected name: string;

  constructor(name: string, config: ChannelConfig) {
    this.name = name;
    this.config = config;
  }

  // Abstract methods to implement
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(message: string, recipient?: string): Promise<void>;
  abstract sendFile(file: Buffer | string, filename: string, recipient?: string): Promise<void>;
  abstract isConfigured(): boolean;
  abstract handleWebhook?(req: any, res: any): Promise<void>;

  // Common functionality
  protected shouldAllowMessage(message: BaseMessage): boolean {
    // DM policy check
    if (!message.metadata?.groupId) {
      return this.checkDmPolicy(message.sender.id);
    }

    // Group policy check
    return this.checkGroupPolicy(message);
  }

  protected checkDmPolicy(senderId: string): boolean {
    switch (this.config.dmPolicy) {
      case "open":
        return this.config.allowFrom?.includes("*") || false;
      case "allowlist":
        return this.config.allowFrom?.includes(senderId) || false;
      case "pairing":
        // Check if sender is in pairing store
        return this.isPaired(senderId);
      case "disabled":
      default:
        return false;
    }
  }

  protected checkGroupPolicy(message: BaseMessage): boolean {
    if (!message.metadata?.groupId) return false;

    const groupConfig = this.config.groups?.[message.metadata.groupId] || 
                     this.config.groups?.["*"];

    if (!groupConfig) return false;

    // Check group allowlist
    if (this.config.groupPolicy === "allowlist") {
      const groupAllowed = this.config.groupAllowFrom?.includes(message.sender.id) ||
                       this.config.groupAllowFrom?.includes("*");
      if (!groupAllowed) return false;
    }

    // Check mention gating
    if (groupConfig.requireMention) {
      const mentions = message.metadata.mentions || [];
      const hasMention = mentions.some(mention => 
        mention.includes("krab") || mention.includes("openclaw")
      );
      if (!hasMention) return false;
    }

    return true;
  }

  protected isPaired(senderId: string): boolean {
    // TODO: Implement pairing store
    return false;
  }

  // Voice message handling
  protected async processVoiceMessage(message: MultiModalMessage): Promise<MultiModalMessage> {
    if (!message.voiceMessage || !message.media) {
      return message;
    }

    try {
      // Import voice tools dynamically to avoid circular dependencies
      const { createVoiceManager } = await import("../voice/tools.js");
      const voiceManager = createVoiceManager();
      await voiceManager.initialize();

      // Find audio attachment
      const audioAttachment = message.media.find(m => m.type === "audio");
      if (!audioAttachment) {
        logger.warn(`[${this.name}] Voice message without audio attachment`);
        return message;
      }

      // Transcribe audio
      let transcriptionResult;
      if (audioAttachment.buffer) {
        // Use buffer directly
        transcriptionResult = await voiceManager.transcribeAudioBuffer(
          audioAttachment.buffer,
          `voice_${message.id}.wav`
        );
      } else if (audioAttachment.url) {
        // Download from URL
        transcriptionResult = await voiceManager.transcribeAudioUrl(audioAttachment.url);
      } else {
        logger.warn(`[${this.name}] Voice message audio not accessible`);
        return message;
      }

      // Update message with transcription
      message.transcription = transcriptionResult.text;
      message.transcriptionConfidence = transcriptionResult.confidence;

      logger.info(`[${this.name}] Voice transcribed: ${transcriptionResult.text.substring(0, 50)}...`);

    } catch (error) {
      logger.error(`[${this.name}] Voice processing failed:`, error);
      message.transcription = "[Voice transcription failed]";
    }

    return message;
  }

  protected async generateVoiceReply(message: MultiModalMessage, response: string): Promise<MultiModalMessage> {
    if (!message.voiceReply) {
      return message;
    }

    try {
      // Import voice tools dynamically
      const { createVoiceManager } = await import("../voice/tools.js");
      const voiceManager = createVoiceManager();
      await voiceManager.initialize();

      // Update TTS options
      voiceManager.updateTTSOptions({
        voice: message.voiceReplyVoice || "alloy"
      });

      // Generate speech
      const audioResult = await voiceManager.synthesizeSpeech(response);

      // Add audio attachment to message
      if (!message.media) {
        message.media = [];
      }

      message.media.push({
        type: "audio",
        buffer: audioResult.audioData,
        filename: `response_${message.id}.mp3`,
        mimeType: audioResult.contentType,
        size: audioResult.audioData.length,
        metadata: {
          duration: audioResult.duration
        }
      });

      logger.info(`[${this.name}] Voice reply generated: ${response.substring(0, 50)}...`);

    } catch (error) {
      logger.error(`[${this.name}] Voice reply generation failed:`, error);
    }

    return message;
  }

  // Enhanced message processing with voice support
  protected async handleIncomingMessage(message: BaseMessage): Promise<void> {
    logger.info(`[${this.name}] Message from ${message.sender.username || message.sender.id}: ${message.content}`);

    if (!this.shouldAllowMessage(message)) {
      logger.warn(`[${this.name}] Message blocked by policy`);
      return;
    }

    // Process voice messages if this is a multi-modal message
    let processedMessage = message;
    if ('voiceMessage' in message && message.voiceMessage) {
      processedMessage = await this.processVoiceMessage(message as MultiModalMessage);
    }

    // Process message through agent
    // TODO: Integrate with Agent class
    logger.debug(`[${this.name}] Processing message: ${processedMessage.content}`);
  }

  protected extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);
    return matches || [];
  }

  protected formatResponse(response: string, originalMessage?: BaseMessage): string {
    // Add formatting based on channel capabilities
    return response;
  }

  // Utility methods
  getName(): string {
    return this.name;
  }

  getConfig(): ChannelConfig {
    return this.config;
  }

  updateConfig(config: Partial<ChannelConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(`[${this.name}] Configuration updated`);
  }
}

// ── Channel Factory ────────────────────────────────────────────
export interface ChannelConstructor {
  new(name: string, config: ChannelConfig): BaseChannel;
}

export class ChannelFactory {
  private static channels = new Map<string, ChannelConstructor>();

  static register(name: string, channelClass: ChannelConstructor): void {
    this.channels.set(name.toLowerCase(), channelClass);
    logger.info(`[ChannelFactory] Registered channel: ${name}`);
  }

  static create(name: string, config: ChannelConfig): BaseChannel | null {
    const ChannelClass = this.channels.get(name.toLowerCase());
    if (!ChannelClass) {
      logger.error(`[ChannelFactory] Unknown channel: ${name}`);
      return null;
    }

    return new ChannelClass(name, config);
  }

  static getAvailableChannels(): string[] {
    return Array.from(this.channels.keys());
  }
}

// ── Channel Manager ────────────────────────────────────────────
export class ChannelManager {
  private channels = new Map<string, BaseChannel>();

  async addChannel(name: string, config: ChannelConfig): Promise<void> {
    const channel = ChannelFactory.create(name, config);
    if (!channel) {
      throw new Error(`Failed to create channel: ${name}`);
    }

    if (!channel.isConfigured()) {
      throw new Error(`Channel ${name} is not properly configured`);
    }

    await channel.start();
    this.channels.set(name, channel);
    logger.info(`[ChannelManager] Started channel: ${name}`);
  }

  async removeChannel(name: string): Promise<void> {
    const channel = this.channels.get(name);
    if (channel) {
      await channel.stop();
      this.channels.delete(name);
      logger.info(`[ChannelManager] Stopped channel: ${name}`);
    }
  }

  getChannel(name: string): BaseChannel | undefined {
    return this.channels.get(name);
  }

  getAllChannels(): BaseChannel[] {
    return Array.from(this.channels.values());
  }

  async broadcast(message: string): Promise<void> {
    const promises = Array.from(this.channels.values()).map(
      channel => channel.sendMessage(message)
    );
    
    await Promise.allSettled(promises);
    logger.info(`[ChannelManager] Broadcast message to ${this.channels.size} channels`);
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this.channels.values()).map(
      channel => channel.stop()
    );
    
    await Promise.all(promises);
    this.channels.clear();
    logger.info("[ChannelManager] All channels stopped");
  }
}
