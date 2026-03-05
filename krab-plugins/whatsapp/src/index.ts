import {
  Channel,
  ChannelMessage,
  ChannelResponse,
} from "../../../src/plugins/types.js";
import { logger } from "../../../src/utils/logger.js";
import path from "node:path";

/**
 * 🦀 Krab WhatsApp Plugin
 * Implementation using Baileys (Multi-device)
 */
class WhatsAppChannel implements Channel {
  name = "whatsapp";
  platform = "whatsapp" as const;
  private onMessageCb: (
    msg: ChannelMessage,
  ) => Promise<ChannelResponse | void> = async () => {};
  private sock: any = null;

  async start(config: any): Promise<void> {
    try {
      const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
      } = await import("@whiskeysockets/baileys");

      // Store auth in data directory
      const authDir = path.resolve(
        process.env.KRAB_STATE_DIR || "~/.krab",
        "whatsapp-auth",
      );
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: { level: "error" } as any,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", (update: any) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
          const shouldReconnect =
            lastDisconnect.error?.output?.statusCode !==
            DisconnectReason.loggedOut;
          logger.warn(
            `[WhatsApp] Connection closed: ${lastDisconnect.error}. Reconnecting: ${shouldReconnect}`,
          );
          if (shouldReconnect) this.start(config);
        } else if (connection === "open") {
          logger.info("[WhatsApp] ✅ Connected");
        }
      });

      this.sock.ev.on("messages.upsert", async (m: any) => {
        if (m.type === "notify") {
          for (const msg of m.messages) {
            // Ignore if from me or no content
            if (msg.key.fromMe || !msg.message) continue;

            const content =
              msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!content) continue;

            const chatMsg: ChannelMessage = {
              id: msg.key.id!,
              content,
              sender: {
                id: msg.key.remoteJid!,
                name: msg.pushName || "Unknown",
              },
              sessionId: msg.key.remoteJid!,
              timestamp: new Date((msg.messageTimestamp as number) * 1000),
            };

            const resp = await this.onMessageCb(chatMsg);
            if (resp) {
              await this.sendMessage(msg.key.remoteJid!, resp);
            }
          }
        }
      });
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND") {
        logger.error(
          "[WhatsApp] ❌ '@whiskeysockets/baileys' not found! Please run 'npm install @whiskeysockets/baileys'",
        );
      } else {
        logger.error(`[WhatsApp] ❌ Error starting WhatsApp: ${err.message}`);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      logger.info("[WhatsApp] Stopped");
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
    if (!this.sock) return;

    // Handle Media
    if (response.media && response.media.length > 0) {
      for (const m of response.media) {
        try {
          if (m.type === "image") {
            await this.sock.sendMessage(targetId, {
              image: { url: m.url },
              caption: m.caption,
            });
          } else if (m.type === "audio") {
            await this.sock.sendMessage(targetId, {
              audio: { url: m.url },
              mimetype: "audio/mp4",
            });
          } else if (m.type === "video") {
            await this.sock.sendMessage(targetId, {
              video: { url: m.url },
              caption: m.caption,
            });
          } else if (m.type === "document") {
            await this.sock.sendMessage(targetId, {
              document: { url: m.url },
              fileName: m.filename,
              mimetype: "application/octet-stream",
            });
          }
        } catch (err: any) {
          logger.error(
            `[WhatsApp] Failed to send media ${m.url}: ${err.message}`,
          );
        }
      }
    }

    // Handle Text Content
    if (response.content) {
      await this.sock.sendMessage(targetId, { text: response.content });
    }
  }
}

export const whatsappChannel = new WhatsAppChannel();

export function onStart() {
  logger.info("[WhatsApp Plugin] Loading...");
}
