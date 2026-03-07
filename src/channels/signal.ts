// ============================================================
// 🦀 Krab — Signal Channel
// Uses Signal API (signal-cli orSignald)
// ============================================================
import { BaseChannel, ChannelConfig, BaseMessage, MediaAttachment, MultiModalMessage } from "./base.js";
import { multiModalProcessor } from "../multimodal/index.js";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let signalClient: any = null;

// ── Signal Message Types ───────────────────────────────────
interface SignalMessage {
  id: string;
  source: string;
  sourceNumber?: string;
  sourceUuid?: string;
  timestamp: number;
  message: string;
  messageType: string;
  groupId?: string;
  groupName?: string;
  attachments?: Array<{
    id: string;
    contentType: string;
    filename?: string;
    size?: number;
  }>;
}

// ── Signal Channel Implementation ───────────────────────────
export class SignalChannel extends BaseChannel {
  private process: any = null;
  private isConnected = false;
  private account: string = "";
  private pipePath: string = "";

  constructor(config: ChannelConfig) {
    super("signal", config);
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Signal channel is not properly configured");
    }

    try {
      // Check for signal-cli or signald
      this.account = this.getAccount();
      this.pipePath = this.getPipePath();

      // Try to connect to signal-cli REST API or signald socket
      await this.connect();
      
      this.isConnected = true;
      logger.info(`[Signal] Channel started for account: ${this.account}`);
    } catch (error) {
      logger.error("[Signal] Failed to start channel:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isConnected = false;
    logger.info("[Signal] Channel stopped");
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Signal channel is not connected");
    }

    if (!recipient) {
      throw new Error("Signal recipient is required");
    }

    try {
      await this.sendSignalMessage(recipient, message);
    } catch (error) {
      logger.error("[Signal] Failed to send message:", error);
      throw error;
    }
  }

  async sendFile(file: Buffer | string, filename: string, recipient?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Signal channel is not connected");
    }

    if (!recipient) {
      throw new Error("Signal recipient is required");
    }

    try {
      // Signal supports sending attachments
      await this.sendSignalAttachment(recipient, file, filename);
    } catch (error) {
      logger.error("[Signal] Failed to send file:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(this.getAccount() || this.config.botToken);
  }

  // ── Signal-specific Methods ─────────────────────────────────
  private getAccount(): string {
    if (this.config.botToken) {
      return this.config.botToken;
    }
    return process.env.SIGNAL_ACCOUNT || "";
  }

  private getPipePath(): string {
    return process.env.SIGNAL_PIPE_PATH || "/tmp/signal";
  }

  private async connect(): Promise<void> {
    // Try REST API first (signal-cli)
    const apiUrl = process.env.SIGNAL_API_URL || "http://localhost:8080";
    
    try {
      const response = await fetch(`${apiUrl}/v1/about`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.config.botToken || process.env.SIGNAL_API_TOKEN}`
        }
      });
      
      if (response.ok) {
        logger.info("[Signal] Connected via REST API");
        return;
      }
    } catch {
      logger.debug("[Signal] REST API not available, trying socket...");
    }

    // Fall back to signald socket
    const socketPath = process.env.SIGNALD_SOCKET || "/var/run/signald/signald.sock";
    logger.info(`[Signal] Will use socket: ${socketPath}`);
  }

  private async sendSignalMessage(recipient: string, message: string): Promise<void> {
    const apiUrl = process.env.SIGNAL_API_URL || "http://localhost:8080";
    const token = this.config.botToken || process.env.SIGNAL_API_TOKEN;

    const response = await fetch(`${apiUrl}/v2/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        recipients: [recipient],
        message: message
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send signal message: ${response.statusText}`);
    }
  }

  private async sendSignalAttachment(recipient: string, file: Buffer | string, filename: string): Promise<void> {
    const apiUrl = process.env.SIGNAL_API_URL || "http://localhost:8080";
    const token = this.config.botToken || process.env.SIGNAL_API_TOKEN;

    const formData = new FormData();
    formData.append("recipient", recipient);
    
    if (typeof file === "string") {
      // URL
      formData.append("fileUrl", file);
    } else {
      // Buffer
      const blob = new Blob([new Uint8Array(file)]);
      formData.append("file", blob, filename);
    }
    
    formData.append("message", ""); // Optional caption

    const response = await fetch(`${apiUrl}/v2/attach`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to send signal attachment: ${response.statusText}`);
    }
  }

  // ── Webhook Handler (for Signal API webhooks) ───────────────
  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      const envelope = req.body;
      
      if (!envelope) {
        res.status(200).send("OK");
        return;
      }

      // Handle different message types
      if (envelope.dataMessage) {
        const baseMessage = this.convertSignalToMessage(envelope);
        await this.processIncomingMessage(baseMessage);
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("[Signal] Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  private convertSignalToMessage(envelope: any): BaseMessage {
    const dataMessage = envelope.dataMessage;
    const source = envelope.source || dataMessage?.source;
    
    return {
      id: dataMessage?.timestamp?.toString() || `sig_${Date.now()}`,
      timestamp: new Date(dataMessage?.timestamp || Date.now()),
      sender: {
        id: source,
        username: source
      },
      channel: "signal",
      content: dataMessage?.message || "",
      type: "text",
      metadata: {
        groupId: dataMessage?.groupId,
        groupName: dataMessage?.groupV2?.name
      }
    };
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
      logger.error("[Signal] Failed to process voice message:", error);
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
      logger.error("[Signal] Failed to analyze image:", error);
      return "Sorry, I couldn't analyze this image.";
    }
  }

  getMediaLimits() {
    return {
      maxImageSize: 100 * 1024 * 1024, // 100MB
      maxAudioSize: 100 * 1024 * 1024, // 100MB
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      supportedAudioTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/aac"],
      supportedVideoTypes: ["video/mp4", "video/avi", "video/quicktime"],
      supportedFileTypes: ["*/*"]
    };
  }

  // ── Signal-specific Methods ─────────────────────────────────
  async listGroups(): Promise<Array<{ id: string; name: string }>> {
    const apiUrl = process.env.SIGNAL_API_URL || "http://localhost:8080";
    const token = this.config.botToken || process.env.SIGNAL_API_TOKEN;

    try {
      const response = await fetch(`${apiUrl}/v1/groups`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list groups: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.groups || []) as Array<{ id: string; name: string }>;
    } catch (error) {
      logger.error("[Signal] Failed to list groups:", error);
      return [];
    }
  }

  async joinGroup(groupId: string): Promise<void> {
    const apiUrl = process.env.SIGNAL_API_URL || "http://localhost:8080";
    const token = this.config.botToken || process.env.SIGNAL_API_TOKEN;

    const response = await fetch(`${apiUrl}/v1/groups/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ groupId })
    });

    if (!response.ok) {
      throw new Error(`Failed to join group: ${response.statusText}`);
    }

    logger.info(`[Signal] Joined group: ${groupId}`);
  }

  async leaveGroup(groupId: string): Promise<void> {
    const apiUrl = process.env.SIGNAL_API_URL || "http://localhost:8080";
    const token = this.config.botToken || process.env.SIGNAL_API_TOKEN;

    const response = await fetch(`${apiUrl}/v1/groups/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ groupId })
    });

    if (!response.ok) {
      throw new Error(`Failed to leave group: ${response.statusText}`);
    }

    logger.info(`[Signal] Left group: ${groupId}`);
  }
}

// ── Register Channel ───────────────────────────────────────────
export function registerSignalChannel(): void {
  logger.info("[Signal] Channel registration ready");
}

export default SignalChannel;
