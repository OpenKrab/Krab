// ============================================================
// 🦀 Krab — Channel Base Interface (OpenClaw-inspired)
// ============================================================
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../core/config.js";
import { Agent } from "../core/agent.js";
import type { STTResult } from "../voice/stt.js";
import { StreamingResponseDispatcher, StreamingOptions, StreamingDispatcher } from "../streaming/dispatcher.js";
import { sessionStore } from "../session/store.js";
import { getAgentManager } from "../agent/manager.js";
import {
  checkDmPolicy,
  checkGroupPolicy,
  shouldAllowChannelMessage,
  PairingManager,
} from "./policy.js";
import {
  buildAgentInput as buildChannelAgentInput,
  getChannelConversationId,
  getChannelReplyTarget,
} from "./session.js";
import {
  extractMediaUrls as extractOutboundMediaUrls,
  parseStructuredResponse as parseOutboundStructuredResponse,
  stripMediaMarkup as stripOutboundMediaMarkup,
} from "./outbound.js";

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
    editedAt?: Date;
    isEdited?: boolean;
    channelId?: string;
    guildId?: string;
    isFromMe?: boolean;
    threadId?: string;
  };
}

// ── Rich Message Types ─────────────────────────────────────────

export interface PollOption {
  id: string;
  text: string;
  voteCount?: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  allowsMultipleAnswers?: boolean;
  isAnonymous?: boolean;
  totalVotes?: number;
  closedAt?: Date;
  createdAt: Date;
}

export interface Reaction {
  emoji: string;
  count: number;
  users?: string[];
}

export interface MessageReactions {
  [emoji: string]: Reaction;
}

export interface Button {
  id: string;
  text: string;
  style?: "primary" | "secondary" | "danger" | "default";
  url?: string;
}

export interface ButtonRow {
  buttons: Button[];
}

export interface InteractiveMessage {
  type: "buttons" | "carousel" | "list";
  title?: string;
  content?: string;
  buttonRows?: ButtonRow[];
  sections?: {
    title?: string;
    rows: { id: string; title: string; description?: string }[];
  }[];
}

export interface MessageEdit {
  messageId: string;
  newContent: string;
  editedAt: Date;
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
  allowBots?: boolean;
  groupAllowFrom?: string[];
  groups?: Record<string, GroupConfig>;
  // Channel-specific properties
  botToken?: string;
  channelAccessToken?: string;
  channelSecret?: string;
  webhookPath?: string;
  webhookUrl?: string;
  mediaMaxMb?: number;
  // Streaming overrides
  blockStreaming?: "on" | "off";
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  maxLinesPerMessage?: number;
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

// ── Channel Capabilities ──────────────────────────────────────────
export interface ChannelCapabilities {
  polls: boolean;
  reactions: boolean;
  edit: boolean;
  unsend: boolean;
  reply: boolean;
  effects: boolean;
  groupManagement: boolean;
  threads: boolean;
  media: boolean;
  nativeCommands: boolean;
  buttons: boolean;
  carousels: boolean;
  voiceMessages: boolean;
}

export const DEFAULT_CAPABILITIES: ChannelCapabilities = {
  polls: false,
  reactions: false,
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

// ── Base Channel Interface ────────────────────────────────────────
export abstract class BaseChannel {
  protected config: ChannelConfig;
  protected name: string;
  private agent: Agent | null = null;
  private static pairingManager: PairingManager | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastMessageTimes: Map<string, number> = new Map();

  constructor(name: string, config: ChannelConfig) {
    this.name = name;
    this.config = config;
  }

  static getPairingManager(): PairingManager {
    if (!BaseChannel.pairingManager) {
      BaseChannel.pairingManager = new PairingManager();
    }
    return BaseChannel.pairingManager;
  }

  // Abstract methods to implement
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(message: string, recipient?: string): Promise<void>;
  abstract sendFile(file: Buffer | string, filename: string, recipient?: string): Promise<void>;
  abstract isConfigured(): boolean;
  
  // Channel capabilities (override in subclasses)
  getCapabilities(): ChannelCapabilities {
    return { ...DEFAULT_CAPABILITIES };
  }

  // Rich message methods (optional - override if supported)
  async sendPoll?(question: string, pollOptions: string[], recipient?: string, opts?: {
    allowsMultipleAnswers?: boolean;
    isAnonymous?: boolean;
  }): Promise<string>;
  
  async sendInteractive?(message: string, interactive: InteractiveMessage, recipient?: string): Promise<void>;
  
  async addReaction?(messageId: string, emoji: string, channelId: string): Promise<void>;
  
  async removeReaction?(messageId: string, emoji: string, channelId: string): Promise<void>;
  
  async getReactions?(messageId: string, channelId: string): Promise<MessageReactions>;
  
  async editMessage?(messageId: string, newContent: string, channelId: string): Promise<void>;
  
  async unsendMessage?(messageId: string, channelId: string): Promise<void>;
  
  async sendReply?(message: string, replyToMessageId: string, channelId: string): Promise<void>;
  
  // Directory/Contacts
  async listUsers?(): Promise<{ id: string; name?: string; username?: string }[]>;
  
  async listGroups?(): Promise<{ id: string; name: string; memberCount?: number }[]>;

  async handleWebhook(req: any, res: any): Promise<void> {
    res.status(501).send("Webhook not implemented");
  }

  // Common functionality
  protected shouldAllowMessage(message: BaseMessage): boolean {
    return shouldAllowChannelMessage(this.config, message, (senderId) =>
      this.isPaired(senderId),
    );
  }

  protected checkDmPolicy(senderId: string): boolean {
    return checkDmPolicy(this.config, senderId, (id) => this.isPaired(id));
  }

  protected checkGroupPolicy(message: BaseMessage): boolean {
    return checkGroupPolicy(this.config, message);
  }

  protected isPaired(senderId: string): boolean {
    const pairingManager = BaseChannel.getPairingManager();
    return pairingManager.isPaired(this.name, senderId);
  }

  // Voice message handling
  protected async processIncomingVoiceMessage(message: MultiModalMessage): Promise<MultiModalMessage> {
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
      let transcriptionResult: STTResult;
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
  protected async processIncomingMessage(message: BaseMessage): Promise<void> {
    const debounceMs = this.getDebounceDelay(message);

    if (debounceMs > 0) {
      await this.debouncedProcessMessage(message, debounceMs);
    } else {
      await this.processMessageImmediately(message);
    }
  }

  private async debouncedProcessMessage(message: BaseMessage, debounceMs: number): Promise<void> {
    const messageKey = `${message.sender.id}:${message.metadata?.groupId || 'dm'}`;

    // Clear existing timer for this sender/channel
    const existingTimer = this.debounceTimers.get(messageKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(messageKey);
      await this.processMessageImmediately(message);
    }, debounceMs);

    this.debounceTimers.set(messageKey, timer);
    this.lastMessageTimes.set(messageKey, Date.now());
  }

  private async processMessageImmediately(message: BaseMessage): Promise<void> {
    logger.info(`[${this.name}] Message from ${message.sender.username || message.sender.id}: ${message.content}`);

    if (!this.shouldAllowMessage(message)) {
      logger.warn(`[${this.name}] Message blocked by policy`);
      return;
    }

    // Process voice messages if this is a multi-modal message
    let processedMessage = message;
    if ('voiceMessage' in message && message.voiceMessage) {
      processedMessage = await this.processIncomingVoiceMessage(message as MultiModalMessage);
    }

    const conversationId = this.getConversationId(processedMessage);
    const replyTarget = this.getReplyTarget(processedMessage);

    // Update session metadata
    sessionStore.getOrCreateSession(conversationId, {
      channel: this.name,
      lastChannel: this.name,
      senderId: processedMessage.sender.id,
      mode: processedMessage.metadata?.groupId ? "group" : "main",
      groupId: processedMessage.metadata?.groupId,
      threadId: (processedMessage.metadata as any)?.threadId
    });

    logger.debug(`[${this.name}] Processing message in conversation ${conversationId}`);

    // Route to appropriate agent and get response
    const agentManager = getAgentManager();
    const response = await agentManager.routeAndRespond(processedMessage, this.name);
    const formatted = this.formatResponse(response, processedMessage);
    await this.dispatchResponse(formatted, replyTarget);
  }

  private getDebounceDelay(message: BaseMessage): number {
    // Skip debouncing for control commands
    if (message.content.startsWith('/')) {
      return 0;
    }

    // Skip debouncing for media messages
    if (message.type !== 'text') {
      return 0;
    }

    const config = loadConfig();
    const messagesConfig = config.agents?.defaults?.messages;

    if (!messagesConfig?.inbound) {
      return 0;
    }

    // Check channel-specific delay
    const channelDelay = messagesConfig.inbound.byChannel?.[this.name];
    if (channelDelay !== undefined) {
      return channelDelay;
    }

    // Use default delay
    return messagesConfig.inbound.debounceMs || 0;
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

  protected getAgent(): Agent {
    if (!this.agent) {
      this.agent = new Agent(loadConfig());
    }
    return this.agent;
  }

  protected getConversationId(message: BaseMessage): string {
    const config = loadConfig();
    const dmScope = config.agents?.defaults?.dmScope;
    return getChannelConversationId(this.name, message, dmScope);
  }

  protected getReplyTarget(message: BaseMessage): string {
    return getChannelReplyTarget(message);
  }

  protected buildAgentInput(message: BaseMessage): string {
    return buildChannelAgentInput(message);
  }

  protected async dispatchResponse(response: string, recipient: string): Promise<void> {
    const trimmed = response.trim();
    if (!trimmed) {
      return;
    }

    const structured = this.parseStructuredResponse(trimmed);
    const mediaUrls = structured?.media || this.extractMediaUrls(trimmed);
    const textOnly = (structured?.text ?? this.stripMediaMarkup(trimmed)).trim();

    // Send media first (not streamed)
    for (const media of mediaUrls) {
      try {
        const filename = media.filename || this.filenameFromUrl(media.url, media.kind);
        const sendAsUrl = this.shouldSendMediaByUrl(media.kind);
        const payload = sendAsUrl ? media.url : await this.downloadMedia(media.url);

        if (media.kind === "image" && typeof (this as any).sendImage === "function") {
          await (this as any).sendImage(payload, filename, media.caption, recipient);
        } else if (media.kind === "audio" && typeof (this as any).sendAudio === "function") {
          await (this as any).sendAudio(payload, filename, media.caption, recipient);
        } else if (media.kind === "video" && typeof (this as any).sendVideo === "function") {
          await (this as any).sendVideo(payload, filename, media.caption, recipient);
        } else {
          await this.sendFile(payload, filename, recipient);
        }
      } catch (error) {
        logger.warn(`[${this.name}] Media send failed for ${media.url}, falling back to text: ${(error as Error).message}`);
        const fallback = [media.caption, media.url].filter(Boolean).join("\n");
        await this.sendMessage(fallback, recipient);
      }
    }

    // Send text with streaming support
    if (textOnly) {
      const streamingOptions = this.getStreamingOptions();

      if (streamingOptions.enabled) {
        const dispatcher = {
          sendBlock: async (text: string) => {
            await this.sendMessage(text, recipient);
          },
          sendFinal: async (text: string) => {
            await this.sendMessage(text, recipient);
          }
        };

        const streamingDispatcher = new StreamingResponseDispatcher(streamingOptions, dispatcher);
        await streamingDispatcher.sendResponse(textOnly);
      } else {
        await this.sendMessage(textOnly, recipient);
      }
    }
  }

  protected extractMediaUrls(text: string): Array<{ url: string; caption?: string; filename?: string; kind: "image" | "audio" | "video" | "file" }> {
    return extractOutboundMediaUrls(
      text,
      (url) => this.classifyMediaUrl(url),
      (url) => this.looksLikeMediaUrl(url),
    );
  }

  protected stripMediaMarkup(text: string): string {
    return stripOutboundMediaMarkup(text, (url) => this.looksLikeMediaUrl(url));
  }

  protected looksLikeMediaUrl(url: string): boolean {
    return /\.(png|jpg|jpeg|gif|webp|mp3|wav|ogg|m4a|mp4|mov|avi|pdf|txt|csv|json)$/i.test(url);
  }

  protected classifyMediaUrl(url: string): "image" | "audio" | "video" | "file" {
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(url)) return "image";
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) return "audio";
    if (/\.(mp4|mov|avi|webm)$/i.test(url)) return "video";
    return "file";
  }

  protected async downloadMedia(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${url}`);
    }
    const data = await response.arrayBuffer();
    return Buffer.from(data);
  }

  protected filenameFromUrl(url: string, kind: "image" | "audio" | "video" | "file"): string {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    if (lastSegment) {
      return lastSegment;
    }
    const extensionMap = {
      image: "png",
      audio: "mp3",
      video: "mp4",
      file: "bin"
    };
    return `${kind}-${Date.now()}.${extensionMap[kind]}`;
  }

  protected parseStructuredResponse(text: string): {
    text: string;
    media: Array<{ url: string; caption?: string; filename?: string; kind: "image" | "audio" | "video" | "file" }>;
  } | null {
    return parseOutboundStructuredResponse(text, (url) =>
      this.classifyMediaUrl(url),
    );
  }

  protected getStreamingOptions(): StreamingOptions {
    const config = loadConfig();
    const defaults = config.agents?.defaults;

    // Check for channel overrides
    const channelOverride = this.config.blockStreaming;
    const enabled = channelOverride === "on" || (channelOverride !== "off" && defaults?.blockStreamingDefault === "on");

    return {
      enabled,
      breakMode: defaults?.blockStreamingBreak || "text_end",
      chunk: defaults?.blockStreamingChunk || {
        minChars: 150,
        maxChars: 1500,
        breakPreference: "paragraph"
      },
      coalesce: defaults?.blockStreamingCoalesce || {
        minChars: 1500,
        maxChars: 3000,
        idleMs: 500
      },
      pacing: defaults?.humanDelay || "off",
      textChunkLimit: this.config.textChunkLimit || this.getChannelTextChunkLimit(),
      chunkMode: this.config.chunkMode || this.getChannelChunkMode(),
      maxLinesPerMessage: this.config.maxLinesPerMessage || this.getChannelMaxLinesPerMessage()
    };
  }

  protected getChannelTextChunkLimit(): number | undefined {
    // Override in subclasses for channel-specific limits
    return undefined;
  }

  protected getChannelChunkMode(): "length" | "newline" | undefined {
    // Override in subclasses
    return "length";
  }

  protected getChannelMaxLinesPerMessage(): number | undefined {
    // Override in subclasses (e.g., Discord has 17 lines)
    return undefined;
  }

  protected shouldSendMediaByUrl(kind: "image" | "audio" | "video" | "file"): boolean {
    return this.name === "line";
  }
}
export interface ChannelConstructor {
  new(config: ChannelConfig): BaseChannel;
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

    return new ChannelClass(config);
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
