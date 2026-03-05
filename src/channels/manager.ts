// ============================================================
// 🦀 Krab — Channel Manager
// Bridges communication platforms (TG, WA, etc.) to Krab Agent
// ============================================================
import { pluginLoader } from "../plugins/loader.js";
import { Channel, ChannelMessage, ChannelResponse } from "../plugins/types.js";
import { Agent } from "../core/agent.js";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../core/krab-config.js";

export class ChannelManager {
  private agent: Agent;
  private channels: Channel[] = [];
  private activeMessageHandlers = new Map<
    string,
    (msg: ChannelMessage) => Promise<ChannelResponse | void>
  >();

  constructor(agent: Agent) {
    this.agent = agent;
  }

  /**
   * Discovers and starts all loaded channels
   */
  async start(): Promise<void> {
    this.channels = pluginLoader.getChannels();
    const config = loadConfig();
    const channelConfigs = (config as any).channels || {};

    if (this.channels.length === 0) {
      logger.debug("[ChannelManager] No channels discovered, skipping start");
      return;
    }

    for (const channel of this.channels) {
      try {
        const chanConfig = channelConfigs[channel.name] || {};

        // Skip if not configured or disabled
        if (chanConfig.enabled === false) {
          logger.debug(
            `[ChannelManager] Channel "${channel.name}" is disabled in config`,
          );
          continue;
        }

        logger.info(
          `[ChannelManager] Starting channel: ${channel.name} (${channel.platform})...`,
        );

        // Set up the message handler
        channel.onMessage(async (msg: ChannelMessage) => {
          return this.handleIncomingMessage(channel, msg);
        });

        await channel.start(chanConfig);
        logger.info(`[ChannelManager] ✅ Channel "${channel.name}" ready`);
      } catch (err: any) {
        logger.error(
          `[ChannelManager] ❌ Failed to start channel "${channel.name}": ${err.message}`,
        );
      }
    }
  }

  /**
   * Gracefully stops all channels
   */
  async stop(): Promise<void> {
    logger.info("[ChannelManager] Shutting down channels...");
    for (const channel of this.channels) {
      try {
        await channel.stop();
      } catch (err: any) {
        logger.warn(
          `[ChannelManager] Error stopping channel "${channel.name}": ${err.message}`,
        );
      }
    }
  }

  /**
   * Main bridge between Channel Plugin and Krab Agent
   */
  private async handleIncomingMessage(
    channel: Channel,
    msg: ChannelMessage,
  ): Promise<ChannelResponse | void> {
    try {
      logger.info(
        `[Channel:${channel.platform}] 📨 Message from ${msg.sender.name || msg.sender.id} in session ${msg.sessionId}`,
      );

      // 1. Process with Agent
      // TODO: In the future, use sessionId to maintain individual agent instances/memories
      const rawResponse = await this.agent.chat(msg.content);

      // 2. Wrap in ChannelResponse and extract media
      const responseObj: ChannelResponse = { content: rawResponse };

      const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
      let match;
      while ((match = imgRegex.exec(rawResponse)) !== null) {
        if (!responseObj.media) responseObj.media = [];
        responseObj.media.push({
          type: "image",
          caption: match[1] || undefined,
          url: match[2],
        });
      }

      // Remove markdown images so platforms like WhatsApp don't send both native image and raw URL string
      responseObj.content = responseObj.content.replace(imgRegex, "").trim();

      return responseObj;
    } catch (err: any) {
      logger.error(
        `[Channel:${channel.platform}] Error processing message: ${err.message}`,
      );
      return {
        content: `⚠️ Sorry, I encountered an error: ${err.message}`,
      };
    }
  }

  /**
   * Proactively send a message to a channel target
   */
  async sendTo(
    channelName: string,
    targetId: string,
    response: ChannelResponse,
  ): Promise<void> {
    const channel = this.channels.find((c) => c.name === channelName);
    if (!channel) {
      throw new Error(`Channel "${channelName}" not found or not loaded`);
    }
    await channel.sendMessage(targetId, response);
  }

  /**
   * Get statistics about loaded channels
   */
  getStats() {
    return {
      count: this.channels.length,
      platforms: this.channels.map((c) => ({
        name: c.name,
        platform: c.platform,
      })),
    };
  }
}
