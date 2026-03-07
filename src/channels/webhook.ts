// ============================================================
// 🦀 Krab — Webhook Management
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";

export const WebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
  channel: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export interface WebhookConfig {
  path: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  timeoutMs?: number;
  retryCount?: number;
}

export interface WebhookHandler {
  (event: WebhookEvent): Promise<unknown>;
}

export interface WebhookResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

export class WebhookManager {
  private webhooks = new Map<string, WebhookConfig>();
  private handlers = new Map<string, WebhookHandler[]>();
  private eventHistory: WebhookEvent[] = [];
  private maxHistory = 1000;

  constructor(private channelName: string) {}

  register(path: string, config: Partial<WebhookConfig>, handler: WebhookHandler): void {
    const fullConfig: WebhookConfig = {
      path,
      events: config.events || ["*"],
      enabled: config.enabled ?? true,
      secret: config.secret,
      timeoutMs: config.timeoutMs || 30000,
      retryCount: config.retryCount || 3,
    };

    this.webhooks.set(path, fullConfig);
    
    const handlers = this.handlers.get(path) || [];
    handlers.push(handler);
    this.handlers.set(path, handlers);

    logger.info(`[WebhookManager.${this.channelName}] Registered webhook: ${path}`);
  }

  unregister(path: string): boolean {
    this.webhooks.delete(path);
    this.handlers.delete(path);
    logger.info(`[WebhookManager.${this.channelName}] Unregistered webhook: ${path}`);
    return this.webhooks.has(path) === false;
  }

  async handleRequest(
    path: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<WebhookResponse> {
    const config = this.webhooks.get(path);
    
    if (!config) {
      return { success: false, message: "Webhook not found" };
    }

    if (!config.enabled) {
      return { success: false, message: "Webhook disabled" };
    }

    if (config.secret) {
      const signature = headers["x-webhook-signature"] || headers["x-hub-signature-256"];
      if (!signature) {
        return { success: false, message: "Missing signature" };
      }

      const isValid = this.verifySignature(body, config.secret, signature);
      if (!isValid) {
        return { success: false, message: "Invalid signature" };
      }
    }

    const event = this.parseEvent(body, path);
    if (!event) {
      return { success: false, message: "Invalid event data" };
    }

    if (!this.shouldHandleEvent(config.events, event.type)) {
      return { success: false, message: "Event not subscribed" };
    }

    this.recordEvent(event);

    const handlers = this.handlers.get(path) || [];
    for (const handler of handlers) {
      try {
        const result = await this.executeWithTimeout(handler, event, config.timeoutMs!);
        logger.debug(`[WebhookManager.${this.channelName}] Handled event: ${event.type}`);
        return { success: true, data: result };
      } catch (error) {
        logger.error(`[WebhookManager.${this.channelName}] Handler error:`, error);
        return { success: false, message: String(error) };
      }
    }

    return { success: true };
  }

  private parseEvent(body: unknown, path: string): WebhookEvent | null {
    try {
      const data = typeof body === "string" ? JSON.parse(body) : body;
      
      return {
        id: `evt_${Date.now()}_${randomBytes(4).toString("hex")}`,
        type: (data as any).type || (data as any).message?.type || "unknown",
        timestamp: Date.now(),
        channel: this.channelName,
        data,
      };
    } catch {
      return null;
    }
  }

  private shouldHandleEvent(subscribed: string[], eventType: string): boolean {
    if (subscribed.includes("*")) return true;
    if (subscribed.includes(eventType)) return true;
    
    for (const sub of subscribed) {
      if (sub.endsWith("*")) {
        const prefix = sub.slice(0, -1);
        if (eventType.startsWith(prefix)) return true;
      }
    }
    
    return false;
  }

  private verifySignature(body: unknown, secret: string, signature: string): boolean {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const hmac = createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    
    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private async executeWithTimeout(
    handler: WebhookHandler,
    event: WebhookEvent,
    timeoutMs: number
  ): Promise<unknown> {
    return Promise.race([
      handler(event),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Webhook timeout")), timeoutMs)
      ),
    ]);
  }

  private recordEvent(event: WebhookEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }
  }

  getHistory(channel?: string, eventType?: string, limit = 100): WebhookEvent[] {
    let events = this.eventHistory;
    
    if (channel) {
      events = events.filter((e) => e.channel === channel);
    }
    
    if (eventType) {
      events = events.filter((e) => e.type === eventType);
    }
    
    return events.slice(-limit);
  }

  getWebhook(path: string): WebhookConfig | undefined {
    return this.webhooks.get(path);
  }

  listWebhooks(): { path: string; enabled: boolean; events: string[] }[] {
    return Array.from(this.webhooks.entries()).map(([path, config]) => ({
      path,
      enabled: config.enabled,
      events: config.events,
    }));
  }

  setEnabled(path: string, enabled: boolean): void {
    const config = this.webhooks.get(path);
    if (config) {
      config.enabled = enabled;
      logger.info(`[WebhookManager.${this.channelName}] Webhook ${path} ${enabled ? "enabled" : "disabled"}`);
    }
  }
}

// ── Webhook Builder ─────────────────────────────────────────────

export class WebhookBuilder {
  private config: Partial<WebhookConfig> = {};

  path(path: string): this {
    this.config.path = path;
    return this;
  }

  secret(secret: string): this {
    this.config.secret = secret;
    return this;
  }

  events(...events: string[]): this {
    this.config.events = events;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeoutMs = ms;
    return this;
  }

  retries(count: number): this {
    this.config.retryCount = count;
    return this;
  }

  build(): WebhookConfig {
    return {
      path: this.config.path || "/webhook",
      events: this.config.events || ["*"],
      enabled: this.config.enabled ?? true,
      secret: this.config.secret,
      timeoutMs: this.config.timeoutMs || 30000,
      retryCount: this.config.retryCount || 3,
    };
  }
}
