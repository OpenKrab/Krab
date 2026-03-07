// ============================================================
// 🦀 Krab — WhatsApp Channel (Baileys + QR pairing)
// ============================================================
import { BaseChannel, ChannelConfig, BaseMessage, MediaAttachment, MultiModalMessage } from "./base.js";
import { multiModalProcessor } from "../multimodal/index.js";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let baileys: any = null;
let qrcode: any = null;

// ── WhatsApp Message Types ───────────────────────────────────
interface WhatsAppMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    imageMessage?: {
      caption?: string;
      url: string;
      mimetype: string;
    };
    videoMessage?: {
      caption?: string;
      url: string;
      mimetype: string;
    };
    audioMessage?: {
      url: string;
      mimetype: string;
    };
    documentMessage?: {
      fileName: string;
      caption?: string;
      url: string;
      mimetype: string;
    };
    stickerMessage?: {
      url: string;
    };
  };
  pushName?: string;
}

// ── WhatsApp Channel Implementation ───────────────────────────
export class WhatsAppChannel extends BaseChannel {
  private sock: any = null;
  private isConnected = false;
  private qrCode: string | null = null;
  private qrCallbacks: Array<(qr: string) => void> = [];
  private sessionPath: string;

  constructor(config: ChannelConfig) {
    super("whatsapp", config);
    this.sessionPath = `./data/whatsapp-session-${this.config.botToken || "default"}.json`;
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("WhatsApp channel is not properly configured");
    }

    try {
      // Dynamic import of dependencies
      const baileysModule = await import("@whiskeysockets/baileys").catch(() => null);
      if (!baileysModule) {
        throw new Error("Baileys not installed. Run: npm install @whiskeysockets/baileys");
      }
      baileys = baileysModule;

      const qrcodeModule = await import("qrcode").catch(() => null);
      qrcode = qrcodeModule;

      const { makeWASocket, DisconnectReason, useMultiFileAuthState } = baileys;

      // Use multi-file auth state for session persistence
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath.replace('.json', ''));

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ["Krab", "Desktop", "1.0.0"]
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Save credentials on update
      this.sock.ev.on("creds.update", saveCreds);

      logger.info("[WhatsApp] Channel started, waiting for QR code scan...");

    } catch (error) {
      logger.error("[WhatsApp] Failed to start channel:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.isConnected = false;
      logger.info("[WhatsApp] Channel stopped");
    }
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error("WhatsApp is not connected");
    }

    try {
      const jid = recipient || "status@broadcast"; // Default to status if no recipient
      await this.sock.sendMessage(jid, { text: message });

      logger.debug(`[WhatsApp] Sent message to ${jid}`);
    } catch (error) {
      logger.error("[WhatsApp] Failed to send message:", error);
      throw error;
    }
  }

  async sendImage(imageBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error("WhatsApp is not connected");
    }

    try {
      const jid = recipient || "status@broadcast";
      await this.sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption,
        mimetype: this.getMimeType(filename)
      });

      logger.debug(`[WhatsApp] Sent image to ${jid}`);
    } catch (error) {
      logger.error("[WhatsApp] Failed to send image:", error);
      throw error;
    }
  }

  async sendAudio(audioBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error("WhatsApp is not connected");
    }

    try {
      const jid = recipient || "status@broadcast";
      await this.sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: this.getMimeType(filename),
        ptt: false // Not a voice note
      });

      logger.debug(`[WhatsApp] Sent audio to ${jid}`);
    } catch (error) {
      logger.error("[WhatsApp] Failed to send audio:", error);
      throw error;
    }
  }

  async sendVideo(videoBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error("WhatsApp is not connected");
    }

    try {
      const jid = recipient || "status@broadcast";
      await this.sock.sendMessage(jid, {
        video: videoBuffer,
        caption: caption,
        mimetype: this.getMimeType(filename)
      });

      logger.debug(`[WhatsApp] Sent video to ${jid}`);
    } catch (error) {
      logger.error("[WhatsApp] Failed to send video:", error);
      throw error;
    }
  }

  async sendFile(fileBuffer: Buffer, filename: string, caption?: string, recipient?: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error("WhatsApp is not connected");
    }

    try {
      const jid = recipient || "status@broadcast";
      await this.sock.sendMessage(jid, {
        document: fileBuffer,
        fileName: filename,
        caption: caption,
        mimetype: this.getMimeType(filename)
      });

      logger.debug(`[WhatsApp] Sent file to ${jid}`);
    } catch (error) {
      logger.error("[WhatsApp] Failed to send file:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    // WhatsApp doesn't require explicit configuration beyond enabling
    return this.config.enabled;
  }

  // ── WhatsApp-specific Methods ───────────────────────────────
  getQRCode(): string | null {
    return this.qrCode;
  }

  onQRCode(callback: (qr: string) => void): void {
    this.qrCallbacks.push(callback);
    if (this.qrCode) {
      callback(this.qrCode);
    }
  }

  isAuthenticated(): boolean {
    return this.isConnected;
  }

  // ── Private Methods ─────────────────────────────────────────
  private setupEventHandlers(): void {
    if (!this.sock) return;

    const { DisconnectReason } = baileys;

    // Connection updates
    this.sock.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        logger.info("[WhatsApp] QR Code received - scan with WhatsApp mobile app");

        // Generate and display QR code
        if (qrcode) {
          qrcode.toString(qr, { type: 'terminal', small: true }, (err: any, url: string) => {
            if (!err) {
              console.log("\n🟢 WhatsApp QR Code:");
              console.log(url);
              console.log("\nScan this QR code with your WhatsApp mobile app\n");
            }
          });
        }

        // Notify callbacks
        this.qrCallbacks.forEach(callback => callback(qr));
      }

      if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

        logger.info("[WhatsApp] Connection closed due to:", lastDisconnect?.error, ", reconnecting:", shouldReconnect);

        if (shouldReconnect) {
          // Reconnect after delay
          setTimeout(() => this.start(), 5000);
        } else {
          logger.error("[WhatsApp] Connection closed permanently - needs re-authentication");
        }
      } else if (connection === "open") {
        this.isConnected = true;
        logger.info("[WhatsApp] Connected successfully!");
      }
    });

    // Message handling
    this.sock.ev.on("messages.upsert", async (m: any) => {
      try {
        await this.handleIncomingMessages(m);
      } catch (error) {
        logger.error("[WhatsApp] Error handling messages:", error);
      }
    });

    // Group updates
    this.sock.ev.on("groups.update", (updates: any) => {
      logger.debug("[WhatsApp] Group updates:", updates);
    });
  }

  private async handleIncomingMessages(m: any): Promise<void> {
    if (!m.messages) return;

    for (const msg of m.messages) {
      // Skip own messages unless configured otherwise
      if (msg.key.fromMe) continue;

      const baseMessage = await this.convertToBaseMessage(msg);
      await this.processIncomingMessage(baseMessage);
    }
  }

  private async convertToBaseMessage(msg: WhatsAppMessage): Promise<MultiModalMessage> {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");
    const senderId = (msg as any).key.participant || msg.key.remoteJid;

    // Get contact info
    let displayName = msg.pushName || "Unknown";
    try {
      if (this.sock) {
        const contact = await this.sock.store?.fetchContact?.(senderId);
        if (contact) {
          displayName = contact.notify || contact.name || displayName;
        }
      }
    } catch (error) {
      logger.debug("[WhatsApp] Could not fetch contact info:", error);
    }

    const baseMessage: MultiModalMessage = {
      id: msg.key.id,
      timestamp: new Date(),
      sender: {
        id: senderId,
        displayName: displayName
      },
      channel: "whatsapp",
      content: "",
      type: "text",
      media: [],
      metadata: {
        groupId: isGroup ? jid : undefined,
        replyTo: undefined // TODO: Extract reply context
      }
    };

    // Process message content
    if (msg.message) {
      if (msg.message.conversation) {
        baseMessage.content = msg.message.conversation;
      } else if (msg.message.imageMessage) {
        baseMessage.type = "image";
        baseMessage.content = msg.message.imageMessage.caption || "";
        baseMessage.media = [{
          type: "image",
          url: msg.message.imageMessage.url,
          mimeType: msg.message.imageMessage.mimetype
        }];
      } else if (msg.message.videoMessage) {
        baseMessage.type = "video";
        baseMessage.content = msg.message.videoMessage.caption || "";
        baseMessage.media = [{
          type: "video",
          url: msg.message.videoMessage.url,
          mimeType: msg.message.videoMessage.mimetype
        }];
      } else if (msg.message.audioMessage) {
        baseMessage.type = "audio";
        baseMessage.media = [{
          type: "audio",
          url: msg.message.audioMessage.url,
          mimeType: msg.message.audioMessage.mimetype
        }];
      } else if (msg.message.documentMessage) {
        baseMessage.type = "file";
        baseMessage.content = msg.message.documentMessage.caption || "";
        baseMessage.media = [{
          type: "file",
          url: msg.message.documentMessage.url,
          filename: msg.message.documentMessage.fileName,
          mimeType: msg.message.documentMessage.mimetype
        }];
      } else if (msg.message.stickerMessage) {
        baseMessage.type = "sticker";
        baseMessage.media = [{
          type: "file",
          url: msg.message.stickerMessage.url
        }];
      }
    }

    return baseMessage;
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'mp4': 'video/mp4',
      'avi': 'video/avi',
      'mov': 'video/quicktime',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
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
      logger.error("[WhatsApp] Failed to process voice message:", error);
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
      logger.error("[WhatsApp] Failed to analyze image:", error);
      return "Sorry, I couldn't analyze this image.";
    }
  }

  getMediaLimits() {
    return {
      maxImageSize: 16 * 1024 * 1024, // 16MB
      maxAudioSize: 16 * 1024 * 1024, // 16MB
      maxVideoSize: 16 * 1024 * 1024, // 16MB
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      supportedAudioTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac"],
      supportedVideoTypes: ["video/mp4", "video/avi", "video/mov"],
      supportedFileTypes: ["*/*"]
    };
  }

  // ── Webhook Handler (WhatsApp Business API) ─────────────────────
  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      const { object } = req.body;

      if (object !== "whatsapp_business_account") {
        res.status(200).send("OK");
        return;
      }

      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;

      if (!messages || messages.length === 0) {
        res.status(200).send("OK");
        return;
      }

      // Process each message
      for (const msg of messages) {
        const baseMessage = this.convertWebhookToMessage(msg, changes.value.metadata);
        
        // Send typing indicator
        await this.sendTypingIndicator(baseMessage.sender.id);
        
        // Process message through agent
        await this.processIncomingMessage(baseMessage);
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("[WhatsApp] Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  private convertWebhookToMessage(msg: any, metadata: any): BaseMessage {
    const sender = msg.from;
    const type = this.getMessageType(msg);
    
    let content = "";
    if (msg.text?.body) content = msg.text.body;
    else if (msg.image?.caption) content = msg.image.caption;
    else if (msg.video?.caption) content = msg.video.caption;
    else if (msg.document?.caption) content = msg.document.caption;
    else if (msg.location) content = `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`;
    else if (msg.contacts) content = "[Contacts shared]";

    return {
      id: msg.id || `wa_${Date.now()}`,
      timestamp: new Date(parseInt(msg.timestamp) * 1000),
      sender: {
        id: sender,
        username: sender
      },
      channel: "whatsapp",
      content,
      type,
      metadata: {
        groupId: msg.chat?.groupId
      }
    };
  }

  private getMessageType(msg: any): BaseMessage["type"] {
    if (msg.text) return "text";
    if (msg.image) return "image";
    if (msg.audio) return "audio";
    if (msg.video) return "video";
    if (msg.document) return "file";
    if (msg.sticker) return "sticker";
    if (msg.location) return "text";
    if (msg.contacts) return "text";
    return "text";
  }

  private async sendTypingIndicator(recipient: string): Promise<void> {
    if (!this.sock || !this.isConnected) return;
    
    try {
      // Baileys doesn't have built-in typing indicator via webhook
      // This would work with WhatsApp Business API
      logger.debug(`[WhatsApp] Sending typing indicator to ${recipient}`);
    } catch (error) {
      logger.warn("[WhatsApp] Failed to send typing indicator:", error);
    }
  }
}

// ── Register Channel ───────────────────────────────────────────
export function registerWhatsAppChannel(): void {
  logger.info("[WhatsApp] Channel registration ready");
}

// Export for dynamic loading
export default WhatsAppChannel;
