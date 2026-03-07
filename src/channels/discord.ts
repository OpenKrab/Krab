// ============================================================
// 🦀 Krab — Discord Channel (Bolt SDK)
// ============================================================
import { BaseChannel, ChannelConfig, BaseMessage, MediaAttachment, MultiModalMessage } from "./base.js";
import { multiModalProcessor } from "../multimodal/index.js";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let discord: any = null;

// ── Discord Message Types ────────────────────────────────────
interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName?: string;
    bot: boolean;
  };
  channel: {
    id: string;
    type: number; // 0 = text, 1 = dm, 3 = group dm
  };
  guild?: {
    id: string;
    name: string;
  };
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    content_type?: string;
    size: number;
  }>;
  embeds: any[];
  createdTimestamp: number;
  reply?: (options: any) => Promise<any>;
}

// ── Discord Channel Implementation ────────────────────────────
export class DiscordChannel extends BaseChannel {
  private client: any = null;
  private isConnected = false;

  constructor(config: ChannelConfig) {
    super("discord", config);
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Discord channel is not properly configured");
    }

    try {
      // Dynamic import of dependencies
      const discordModule = await import("discord.js").catch(() => null);
      if (!discordModule) {
        throw new Error("Discord.js not installed. Run: npm install discord.js");
      }
      discord = discordModule;

      const { Client, GatewayIntentBits } = discord;

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.GuildMessageTyping,
        ]
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Login with bot token
      const token = this.getBotToken();
      await this.client.login(token);

      this.isConnected = true;
      logger.info(`[Discord] Bot logged in as ${this.client.user?.tag}`);

    } catch (error) {
      logger.error("[Discord] Failed to start channel:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.destroy();
      this.isConnected = false;
      logger.info("[Discord] Channel stopped");
    }
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    try {
      const channelId = recipient || "general"; // Default channel if none specified
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Invalid channel: ${channelId}`);
      }

      await channel.send(message);
      logger.debug(`[Discord] Sent message to ${channelId}`);

    } catch (error) {
      logger.error("[Discord] Failed to send message:", error);
      throw error;
    }
  }

  async sendImage(imageBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    try {
      const channelId = recipient || "general";
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Invalid channel: ${channelId}`);
      }

      const attachment = new discord.AttachmentBuilder(imageBuffer, { name: filename });

      await channel.send({
        content: caption || undefined,
        files: [attachment]
      });

      logger.debug(`[Discord] Sent image to ${channelId}`);

    } catch (error) {
      logger.error("[Discord] Failed to send image:", error);
      throw error;
    }
  }

  async sendAudio(audioBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    try {
      const channelId = recipient || "general";
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Invalid channel: ${channelId}`);
      }

      const attachment = new discord.AttachmentBuilder(audioBuffer, { name: filename });

      await channel.send({
        content: caption || undefined,
        files: [attachment]
      });

      logger.debug(`[Discord] Sent audio to ${channelId}`);

    } catch (error) {
      logger.error("[Discord] Failed to send audio:", error);
      throw error;
    }
  }

  async sendVideo(videoBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    try {
      const channelId = recipient || "general";
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Invalid channel: ${channelId}`);
      }

      const attachment = new discord.AttachmentBuilder(videoBuffer, { name: filename });

      await channel.send({
        content: caption || undefined,
        files: [attachment]
      });

      logger.debug(`[Discord] Sent video to ${channelId}`);

    } catch (error) {
      logger.error("[Discord] Failed to send video:", error);
      throw error;
    }
  }

  async sendFile(fileBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    try {
      const channelId = recipient || "general";
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Invalid channel: ${channelId}`);
      }

      const attachment = new discord.AttachmentBuilder(fileBuffer, { name: filename });

      await channel.send({
        content: caption || undefined,
        files: [attachment]
      });

      logger.debug(`[Discord] Sent file to ${channelId}`);

    } catch (error) {
      logger.error("[Discord] Failed to send file:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.getBotToken();
  }

  // ── Private Methods ─────────────────────────────────────────
  private getBotToken(): string | undefined {
    // Check config first, then environment
    if (this.config.botToken) {
      return this.config.botToken;
    }

    return process.env.DISCORD_BOT_TOKEN;
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    // Ready event
    this.client.once("ready", () => {
      logger.info(`[Discord] Bot is ready! Logged in as ${this.client.user.tag}`);
    });

    // Message event
    this.client.on("messageCreate", async (message: any) => {
      try {
        // Skip own messages and bot messages (unless configured)
        if (message.author.id === this.client.user.id) return;

        // Skip messages from other bots unless explicitly allowed
        if (message.author.bot && !this.config.allowBots) return;

        await this.handleDiscordMessage(message);
      } catch (error) {
        logger.error("[Discord] Error handling message:", error);
      }
    });

    // Error handling
    this.client.on("error", (error: any) => {
      logger.error("[Discord] Client error:", error);
    });

    // Disconnect handling
    this.client.on("disconnect", () => {
      logger.warn("[Discord] Bot disconnected, attempting to reconnect...");
      this.isConnected = false;
    });

    this.client.on("reconnecting", () => {
      logger.info("[Discord] Bot reconnecting...");
    });

    this.client.on("resume", (replayed: number) => {
      logger.info(`[Discord] Bot resumed, replayed ${replayed} events`);
      this.isConnected = true;
    });
  }

  private async handleDiscordMessage(message: DiscordMessage): Promise<void> {
    const baseMessage = await this.convertToBaseMessage(message);
    await this.processIncomingMessage(baseMessage);
  }

  private async convertToBaseMessage(message: DiscordMessage): Promise<MultiModalMessage> {
    const isDM = message.channel.type === 1; // DM channel
    const isGroupDM = message.channel.type === 3; // Group DM

    const baseMessage: MultiModalMessage = {
      id: message.id,
      timestamp: new Date(message.createdTimestamp),
      sender: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName || message.author.username
      },
      channel: "discord",
      content: message.content,
      type: "text",
      media: [],
      metadata: {
        groupId: !isDM ? message.channel.id : undefined,
        groupName: message.guild?.name,
        replyTo: undefined // TODO: Extract reply context
      }
    };

    // Process attachments
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        const mediaType = this.getMediaTypeFromMime(attachment.content_type || "");

        baseMessage.media!.push({
          type: mediaType,
          url: attachment.url,
          filename: attachment.filename,
          mimeType: attachment.content_type,
          size: attachment.size
        });

        // Set primary message type based on first attachment
        if (baseMessage.type === "text") {
          baseMessage.type = mediaType;
        }
      }
    }

    // Process embeds (images, etc.)
    if (message.embeds && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        if (embed.image) {
          baseMessage.media!.push({
            type: "image",
            url: embed.image.url
          });
        }
        if (embed.video) {
          baseMessage.media!.push({
            type: "video",
            url: embed.video.url
          });
        }
      }
    }

    return baseMessage;
  }

  private getMediaTypeFromMime(mimeType: string): MediaAttachment["type"] {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "file";
  }

  // ── Webhook Handler (for Discord Interactions) ──────────────────
  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      const { type, data, member, user, channel_id, guild_id, message } = req.body;

      // Discord Interactions (buttons, select menus, modals)
      if (type === 1) {
        // Ping - respond with Pong
        res.json({ type: 1 });
        return;
      }

      if (type === 2) {
        // Application Command (slash command)
        const commandName = data?.name;
        const options = data?.options || [];
        
        logger.info(`[Discord] Slash command: /${commandName}`);
        
        // Process command and send response
        const response = await this.handleSlashCommand(commandName, options, member, user, channel_id);
        
        res.json({
          type: 4, // Channel Message with Source
          data: {
            content: response,
            flags: 0
          }
        });
        return;
      }

      if (type === 3) {
        // Message Component (button, select menu)
        const componentType = data?.component_type;
        const customId = data?.custom_id;
        const values = data?.values || [];
        
        logger.info(`[Discord] Component interaction: ${customId}`);
        
        // Process component interaction
        const response = await this.handleComponentInteraction(customId, values, member, message);
        
        res.json({
          type: 4,
          data: {
            content: response,
            flags: 0
          }
        });
        return;
      }

      if (type === 4) {
        // Modal Submit
        const customId = data?.custom_id;
        const inputs = data?.components || [];
        
        logger.info(`[Discord] Modal submit: ${customId}`);
        
        const response = await this.handleModalSubmit(customId, inputs, member);
        
        res.json({
          type: 4,
          data: {
            content: response,
            flags: 0
          }
        });
        return;
      }

      // Regular message via webhook (not interaction)
      if (message && data?.content) {
        const baseMessage = this.convertWebhookToMessage(req.body);
        await this.processIncomingMessage(baseMessage);
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("[Discord] Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  private async handleSlashCommand(
    commandName: string,
    options: any[],
    member: any,
    user: any,
    channelId: string
  ): Promise<string> {
    // Build command input from options
    let input = `/${commandName}`;
    for (const opt of options) {
      if (opt.value !== undefined) {
        input += ` ${opt.name}: ${opt.value}`;
      }
    }

    // Create a message object for processing
    const message: BaseMessage = {
      id: `cmd_${Date.now()}`,
      timestamp: new Date(),
      sender: {
        id: member?.id || user?.id || "unknown",
        username: member?.nick || user?.username,
        displayName: member?.displayName || user?.global_name
      },
      channel: "discord",
      content: input,
      type: "text",
      metadata: {
        channelId,
        guildId: member?.guild_id
      }
    };

    await this.processIncomingMessage(message);
    return "Command processed";
  }

  private async handleComponentInteraction(
    customId: string,
    values: string[],
    member: any,
    message: any
  ): Promise<string> {
    const input = `[Interaction: ${customId}] ${values.join(", ")}`;
    
    const msg: BaseMessage = {
      id: `int_${Date.now()}`,
      timestamp: new Date(),
      sender: {
        id: member?.id || "unknown",
        username: member?.nick || member?.user?.username
      },
      channel: "discord",
      content: input,
      type: "text"
    };

    await this.processIncomingMessage(msg);
    return "Interaction processed";
  }

  private async handleModalSubmit(
    customId: string,
    inputs: any[],
    member: any
  ): Promise<string> {
    let input = `[Modal: ${customId}]\n`;
    for (const row of inputs) {
      for (const comp of row.components || []) {
        input += `${comp.label}: ${comp.value}\n`;
      }
    }

    const msg: BaseMessage = {
      id: `modal_${Date.now()}`,
      timestamp: new Date(),
      sender: {
        id: member?.id || "unknown",
        username: member?.nick || member?.user?.username
      },
      channel: "discord",
      content: input,
      type: "text"
    };

    await this.processIncomingMessage(msg);
    return "Modal submitted";
  }

  private convertWebhookToMessage(webhookData: any): BaseMessage {
    const { message, member, channel_id, guild_id } = webhookData;
    
    return {
      id: message?.id || `wh_${Date.now()}`,
      timestamp: new Date(message?.timestamp || Date.now()),
      sender: {
        id: message?.author?.id || member?.id || "unknown",
        username: message?.author?.username || member?.nick,
        displayName: message?.author?.global_name || member?.displayName
      },
      channel: "discord",
      content: message?.content || "",
      type: "text",
      metadata: {
        channelId: channel_id,
        guildId: guild_id
      }
    };
  }

  // ── Multi-modal Interface Implementation ────────────────────
  supportsVoiceMessages(): boolean {
    return false; // Discord doesn't have voice messages, but has voice channels
  }

  supportsVision(): boolean {
    return true; // Can analyze images sent to channels
  }

  async transcribeVoiceMessage(audioBuffer: Buffer): Promise<{
    transcription: string;
    response: string;
  }> {
    // Discord doesn't have voice messages in the traditional sense
    return {
      transcription: "",
      response: "Voice messages are not supported in Discord text channels."
    };
  }

  async analyzeImageBuffer(imageBuffer: Buffer): Promise<string> {
    try {
      return await multiModalProcessor.analyzeImage(imageBuffer);
    } catch (error) {
      logger.error("[Discord] Failed to analyze image:", error);
      return "Sorry, I couldn't analyze this image.";
    }
  }

  getMediaLimits() {
    return {
      maxImageSize: 8 * 1024 * 1024, // 8MB for non-nitro
      maxAudioSize: 8 * 1024 * 1024, // 8MB
      maxVideoSize: 8 * 1024 * 1024, // 8MB for non-nitro
      maxFileSize: 8 * 1024 * 1024,  // 8MB for non-nitro
      supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      supportedAudioTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/flac"],
      supportedVideoTypes: ["video/mp4", "video/quicktime", "video/x-msvideo"],
      supportedFileTypes: ["*/*"]
    };
  }

  // ── Discord-specific Methods ────────────────────────────────
  async getGuilds(): Promise<any[]> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    return Array.from(this.client.guilds.cache.values());
  }

  async getChannels(guildId?: string): Promise<any[]> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    if (guildId) {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error(`Guild not found: ${guildId}`);
      return Array.from(guild.channels.cache.values());
    }

    return Array.from(this.client.channels.cache.values());
  }

  async joinGuild(inviteCode: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("Discord is not connected");
    }

    try {
      await this.client.acceptInvite(inviteCode);
      logger.info(`[Discord] Joined guild via invite: ${inviteCode}`);
    } catch (error) {
      logger.error("[Discord] Failed to join guild:", error);
      throw error;
    }
  }
}

// ── Register Channel ───────────────────────────────────────────
export function registerDiscordChannel(): void {
  logger.info("[Discord] Channel registration ready");
}

// Export for dynamic loading
export default DiscordChannel;
