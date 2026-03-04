// ============================================================
// 🦀 Krab — Channel Registry (OpenClaw-inspired)
// ============================================================
import { ChannelFactory, ChannelManager } from "./base.js";
import { TelegramChannel, registerTelegramChannel } from "./telegram.js";
import { LINEChannel, registerLINEChannel } from "./line.js";
import { WhatsAppChannel, registerWhatsAppChannel } from "./whatsapp.js";
import { DiscordChannel, registerDiscordChannel } from "./discord.js";
import { logger } from "../utils/logger.js";
import type { ChannelConfig } from "./base.js";

// ── Channel Registry ────────────────────────────────────────────
export class ChannelRegistry {
  private static instance: ChannelRegistry;
  private channelManager = new ChannelManager();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ChannelRegistry {
    if (!ChannelRegistry.instance) {
      ChannelRegistry.instance = new ChannelRegistry();
    }
    return ChannelRegistry.instance;
  }

  async initialize(channels: Record<string, ChannelConfig>): Promise<void> {
    if (this.isInitialized) {
      logger.warn("[ChannelRegistry] Already initialized");
      return;
    }

    // Register channel classes with proper constructor signature
    ChannelFactory.register("telegram", TelegramChannel as any);
    ChannelFactory.register("line", LINEChannel as any);
    ChannelFactory.register("whatsapp", WhatsAppChannel as any);
    ChannelFactory.register("discord", DiscordChannel as any);

    // Start enabled channels
    const startPromises = Object.entries(channels)
      .filter(([_, config]) => config.enabled)
      .map(async ([name, config]) => {
        try {
          await this.channelManager.addChannel(name, config);
        } catch (error) {
          logger.error(`[ChannelRegistry] Failed to start channel ${name}:`, error);
        }
      });

    await Promise.allSettled(startPromises);
    this.isInitialized = true;
    
    logger.info(`[ChannelRegistry] Initialized with ${this.channelManager.getAllChannels().length} channels`);
  }

  async addChannel(name: string, config: ChannelConfig): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("ChannelRegistry not initialized");
    }

    await this.channelManager.addChannel(name, config);
  }

  async removeChannel(name: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("ChannelRegistry not initialized");
    }

    await this.channelManager.removeChannel(name);
  }

  getChannel(name: string) {
    return this.channelManager.getChannel(name);
  }

  getAllChannels() {
    return this.channelManager.getAllChannels();
  }

  async broadcast(message: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("ChannelRegistry not initialized");
    }

    await this.channelManager.broadcast(message);
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.channelManager.stopAll();
    this.isInitialized = false;
    logger.info("[ChannelRegistry] Shutdown complete");
  }

  // ── Configuration Helpers ───────────────────────────────────
  validateChannelConfig(name: string, config: any): boolean {
    const requiredFields = this.getRequiredFields(name);
    
    for (const field of requiredFields) {
      if (!config[field]) {
        logger.error(`[ChannelRegistry] Missing required field '${field}' for ${name}`);
        return false;
      }
    }

    return true;
  }

  private getRequiredFields(name: string): string[] {
    const fieldMap: Record<string, string[]> = {
      telegram: ["enabled", "dmPolicy"],
      line: ["enabled", "dmPolicy", "channelAccessToken", "channelSecret"],
      whatsapp: ["enabled", "dmPolicy"],
      discord: ["enabled", "dmPolicy"],
      slack: ["enabled", "dmPolicy"],
      signal: ["enabled", "dmPolicy"],
    };

    return fieldMap[name] || ["enabled"];
  }

  // ── Status and Diagnostics ───────────────────────────────────
  getStatus(): Record<string, any> {
    const channels = this.getAllChannels();
    const status: Record<string, any> = {};

    for (const channel of channels) {
      status[channel.getName()] = {
        name: channel.getName(),
        configured: channel.isConfigured(),
        config: channel.getConfig(),
      };
    }

    return {
      initialized: this.isInitialized,
      totalChannels: channels.length,
      channels: status,
    };
  }

  async testChannel(name: string): Promise<boolean> {
    const channel = this.getChannel(name);
    if (!channel) {
      logger.error(`[ChannelRegistry] Channel ${name} not found`);
      return false;
    }

    try {
      // Test basic functionality
      await channel.sendMessage("Test message from Krab");
      logger.info(`[ChannelRegistry] Test message sent to ${name}`);
      return true;
    } catch (error) {
      logger.error(`[ChannelRegistry] Test failed for ${name}:`, error);
      return false;
    }
  }

  // ── Channel-specific Setup Helpers ─────────────────────────────
  getSetupInstructions(name: string): string {
    const instructions: Record<string, string> = {
      telegram: `
🤖 Telegram Bot Setup:
1. Create bot via @BotFather: /newbot
2. Get bot token
3. Set TELEGRAM_BOT_TOKEN environment variable
4. Add bot to groups (optional)
5. Configure dmPolicy: "pairing" | "allowlist" | "open" | "disabled"

Example config:
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:ABC...",
      "dmPolicy": "pairing",
      "groups": {
        "*": { "requireMention": true }
      }
    }
  }
}
      `,
      line: `
💬 LINE Bot Setup:
1. Create LINE Developers account: https://developers.line.biz/console/
2. Create Messaging API channel
3. Get Channel Access Token and Channel Secret
4. Set LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET
5. Configure webhook URL (HTTPS required)

Example config:
{
  "channels": {
    "line": {
      "enabled": true,
      "channelAccessToken": "LINE_CHANNEL_ACCESS_TOKEN",
      "channelSecret": "LINE_CHANNEL_SECRET",
      "dmPolicy": "pairing",
      "webhookPath": "/line/webhook"
    }
  }
}
      `,
    };

    return instructions[name] || `No setup instructions available for ${name}`;
  }
}

// ── Export Registry Instance ─────────────────────────────────────
export const channelRegistry = ChannelRegistry.getInstance();
