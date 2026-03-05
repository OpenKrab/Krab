import {
  Channel,
  ChannelMessage,
  ChannelResponse,
} from "../../../src/plugins/types.js";
import { logger } from "../../../src/utils/logger.js";

/**
 * 🦀 Krab Discord Plugin
 * Implementation using discord.js
 */
class DiscordChannel implements Channel {
  name = "discord";
  platform = "discord" as const;
  private onMessageCb: (
    msg: ChannelMessage,
  ) => Promise<ChannelResponse | void> = async () => {};
  private client: any = null;

  async start(config: any): Promise<void> {
    const token = config.token || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      logger.warn(
        "[Discord] ⚠️ No bot token found! Please set DISCORD_BOT_TOKEN in .env",
      );
      return;
    }

    try {
      const { Client, GatewayIntentBits, Partials } =
        await import("discord.js");
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel], // For DM support
      });

      this.client.on("ready", () => {
        logger.info(`[Discord] ✅ Bot logged in as ${this.client.user.tag}`);
      });

      this.client.on("messageCreate", async (message: any) => {
        if (message.author.bot) return;

        const chatMsg: ChannelMessage = {
          id: message.id,
          content: message.content,
          sender: {
            id: message.author.id,
            name: message.author.username,
          },
          sessionId: message.channelId,
          timestamp: message.createdAt,
        };

        const resp = await this.onMessageCb(chatMsg);
        if (resp) {
          // Send as reply
          await this.sendMessage(message.channelId, resp);
        }
      });

      await this.client.login(token);
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND") {
        logger.error(
          "[Discord] ❌ 'discord.js' not found! Please run 'npm install discord.js'",
        );
      } else {
        logger.error(`[Discord] ❌ Error starting Discord: ${err.message}`);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      logger.info("[Discord] Stopped");
    }
  }

  onMessage(
    cb: (msg: ChannelMessage) => Promise<ChannelResponse | void>,
  ): void {
    this.onMessageCb = cb;
  }

  async sendMessage(
    targetId: string,
    response: ChannelResponse,
  ): Promise<void> {
    if (!this.client) return;
    try {
      const channel = await this.client.channels.fetch(targetId);
      if (channel && typeof channel.send === "function") {
        const payload: any = {};
        if (response.content) payload.content = response.content;

        if (response.media && response.media.length > 0) {
          // Discord API accepts an array of URLs for files
          payload.files = response.media.map((m) => m.url);
        }

        if (payload.content || payload.files) {
          await channel.send(payload);
        }
      }
    } catch (err: any) {
      logger.error(`[Discord] ❌ Failed to send message: ${err.message}`);
    }
  }
}

export const discordChannel = new DiscordChannel();

export function onStart() {
  logger.info("[Discord Plugin] Loading...");
}
