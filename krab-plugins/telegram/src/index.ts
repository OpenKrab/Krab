import {
  Channel,
  ChannelMessage,
  ChannelResponse,
} from "../../../src/plugins/types.js";
import { logger } from "../../../src/utils/logger.js";

/**
 * 🦀 Krab Telegram Plugin
 * Implementation using grammY (v1.34+)
 */
class TelegramChannel implements Channel {
  name = "telegram";
  platform = "telegram" as const;
  private onMessageCb: (
    msg: ChannelMessage,
  ) => Promise<ChannelResponse | void> = async () => {};
  private bot: any = null;

  async start(config: any): Promise<void> {
    const token = config.token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.warn(
        "[Telegram] ⚠️ No bot token found! Please set TELEGRAM_BOT_TOKEN in .env",
      );
      // Don't throw if not configured, just don't start
      return;
    }

    try {
      // Dynamic import to avoid errors if not installed
      const { Bot } = await import("grammy");
      this.bot = new Bot(token);

      this.bot.on("message:text", async (ctx: any) => {
        const msg: ChannelMessage = {
          id: ctx.message.message_id.toString(),
          content: ctx.message.text || "",
          sender: {
            id: ctx.from.id.toString(),
            name: ctx.from.first_name,
            handle: ctx.from.username,
          },
          sessionId: ctx.chat.id.toString(),
          timestamp: new Date(ctx.message.date * 1000),
        };

        const response = await this.onMessageCb(msg);
        if (response) {
          await this.sendMessage(ctx.chat.id.toString(), response);
        }
      });

      this.bot.start({
        onStart: (info: any) => {
          logger.info(`[Telegram] ✅ Bot @${info.username} started`);
        },
      });
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND") {
        logger.error(
          "[Telegram] ❌ 'grammy' not found! Please run 'npm install grammy'",
        );
      } else {
        logger.error(`[Telegram] ❌ Error: ${err.message}`);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      logger.info("[Telegram] Stopped");
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
    if (!this.bot) return;

    // Handle Media
    if (response.media && response.media.length > 0) {
      for (const m of response.media) {
        try {
          if (m.type === "image") {
            await this.bot.api.sendPhoto(targetId, m.url, {
              caption: m.caption,
            });
          } else if (m.type === "audio") {
            await this.bot.api.sendAudio(targetId, m.url, {
              caption: m.caption,
            });
          } else if (m.type === "video") {
            await this.bot.api.sendVideo(targetId, m.url, {
              caption: m.caption,
            });
          } else if (m.type === "document") {
            await this.bot.api.sendDocument(targetId, m.url, {
              caption: m.caption,
            });
          }
        } catch (err: any) {
          logger.error(
            `[Telegram] Failed to send media ${m.url}: ${err.message}`,
          );
        }
      }
    }

    // Handle Text Content
    if (response.content) {
      await this.bot.api.sendMessage(targetId, response.content);
    }
  }
}

export const telegramChannel = new TelegramChannel();

export async function onStart() {
  logger.info("[Telegram Plugin] Loading...");
}
