// ============================================================
// 🦀 Krab — Transport Stall Watchdog
// OpenClaw-inspired stall detection for message transports
// ============================================================
import { logger } from "../utils/logger.js";

export interface TransportConfig {
  enabled: boolean;
  stallThresholdMs: number;
  checkIntervalMs: number;
  maxStallCount: number;
  recoveryAction?: "restart" | "reconnect" | "notify" | "none";
}

export interface TransportState {
  name: string;
  status: "idle" | "active" | "stalled" | "disconnected" | "recovering";
  lastActivity: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  stallCount: number;
  totalMessages: number;
  failedMessages: number;
  avgLatencyMs?: number;
  pendingMessages: number;
}

export interface TransportStallEvent {
  transport: string;
  timestamp: Date;
  stalledForMs: number;
  pendingMessages: number;
  action: "detected" | "recovered" | "restarted" | "failed";
}

type TransportEventHandler = (event: TransportStallEvent) => void | Promise<void>;

class TransportStallWatchdog {
  private config: TransportConfig = {
    enabled: true,
    stallThresholdMs: 30000,
    checkIntervalMs: 5000,
    maxStallCount: 3,
    recoveryAction: "reconnect",
  };

  private transports = new Map<string, TransportState>();
  private eventHandlers: TransportEventHandler[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private messageTimestamps = new Map<string, { timestamp: number; pending: number }>();

  configure(config: Partial<TransportConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("[Watchdog] Configuration updated:", this.config);
  }

  registerTransport(name: string): void {
    this.transports.set(name, {
      name,
      status: "idle",
      lastActivity: new Date(),
      stallCount: 0,
      totalMessages: 0,
      failedMessages: 0,
      pendingMessages: 0,
    });
    logger.info(`[Watchdog] Registered transport: ${name}`);
  }

  unregisterTransport(name: string): boolean {
    const removed = this.transports.delete(name);
    if (removed) {
      logger.info(`[Watchdog] Unregistered transport: ${name}`);
    }
    return removed;
  }

  onStallEvent(handler: TransportEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private async emitEvent(event: TransportStallEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error("[Watchdog] Event handler error:", error);
      }
    }
  }

  start(): void {
    if (this.intervalId) {
      logger.warn("[Watchdog] Already running");
      return;
    }

    if (!this.config.enabled) {
      logger.info("[Watchdog] Disabled in config");
      return;
    }

    logger.info(`[Watchdog] Starting with interval: ${this.config.checkIntervalMs}ms`);
    
    this.intervalId = setInterval(() => {
      this.checkAll();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[Watchdog] Stopped");
    }
  }

  recordMessageStart(transportName: string): string {
    const transport = this.transports.get(transportName);
    if (!transport) {
      throw new Error(`Unknown transport: ${transportName}`);
    }

    const messageId = `${transportName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    transport.status = "active";
    transport.lastActivity = new Date();
    transport.totalMessages++;
    transport.pendingMessages++;
    
    this.messageTimestamps.set(messageId, {
      timestamp: Date.now(),
      pending: transport.pendingMessages,
    });

    return messageId;
  }

  recordMessageEnd(transportName: string, messageId: string, success: boolean): void {
    const transport = this.transports.get(transportName);
    if (!transport) return;

    const startInfo = this.messageTimestamps.get(messageId);
    if (startInfo) {
      const latency = Date.now() - startInfo.timestamp;
      
      if (transport.avgLatencyMs) {
        transport.avgLatencyMs = (transport.avgLatencyMs * 0.9) + (latency * 0.1);
      } else {
        transport.avgLatencyMs = latency;
      }
      
      this.messageTimestamps.delete(messageId);
    }

    transport.pendingMessages = Math.max(0, transport.pendingMessages - 1);
    transport.lastActivity = new Date();
    transport.lastSuccess = new Date();
    transport.status = transport.pendingMessages > 0 ? "active" : "idle";

    if (!success) {
      transport.failedMessages++;
      transport.lastFailure = new Date();
    }
  }

  recordActivity(transportName: string): void {
    const transport = this.transports.get(transportName);
    if (!transport) return;

    transport.lastActivity = new Date();
    
    if (transport.status === "stalled") {
      transport.status = "idle";
      transport.stallCount = 0;
      this.emitEvent({
        transport: transportName,
        timestamp: new Date(),
        stalledForMs: 0,
        pendingMessages: transport.pendingMessages,
        action: "recovered",
      });
      logger.info(`[Watchdog] ${transportName} recovered from stall`);
    }
  }

  private async checkAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      if (transport.status === "idle" || transport.status === "disconnected") {
        continue;
      }

      await this.checkTransport(transport);
    }
  }

  private async checkTransport(transport: TransportState): Promise<void> {
    const now = Date.now();
    const timeSinceActivity = now - transport.lastActivity.getTime();

    if (timeSinceActivity > this.config.stallThresholdMs) {
      if (transport.status !== "stalled") {
        transport.status = "stalled";
        transport.stallCount++;
        
        logger.warn(`[Watchdog] ${transport.name} stalled (${timeSinceActivity}ms inactive, stall #${transport.stallCount})`);
        
        await this.emitEvent({
          transport: transport.name,
          timestamp: new Date(),
          stalledForMs: timeSinceActivity,
          pendingMessages: transport.pendingMessages,
          action: "detected",
        });
      }

      if (transport.stallCount >= this.config.maxStallCount) {
        await this.handleStallThreshold(transport);
      }
    }
  }

  private async handleStallThreshold(transport: TransportState): Promise<void> {
    logger.error(`[Watchdog] ${transport.name} exceeded max stall count, taking action: ${this.config.recoveryAction}`);

    switch (this.config.recoveryAction) {
      case "restart":
        transport.status = "recovering";
        await this.emitEvent({
          transport: transport.name,
          timestamp: new Date(),
          stalledForMs: 0,
          pendingMessages: transport.pendingMessages,
          action: "restarted",
        });
        break;

      case "reconnect":
        transport.status = "recovering";
        await this.emitEvent({
          transport: transport.name,
          timestamp: new Date(),
          stalledForMs: 0,
          pendingMessages: transport.pendingMessages,
          action: "restarted",
        });
        break;

      case "notify":
        logger.error(`[Watchdog] NOTIFY: Transport ${transport.name} is stalled and may need manual intervention`);
        break;

      case "none":
      default:
        break;
    }
  }

  getTransportState(name: string): TransportState | undefined {
    return this.transports.get(name);
  }

  getAllTransports(): TransportState[] {
    return Array.from(this.transports.values());
  }

  getStalledTransports(): TransportState[] {
    return Array.from(this.transports.values()).filter(t => t.status === "stalled");
  }

  isHealthy(name: string): boolean {
    const transport = this.transports.get(name);
    if (!transport) return false;
    return transport.status !== "stalled" && transport.status !== "disconnected";
  }

  getHealthSummary(): {
    total: number;
    healthy: number;
    stalled: number;
    recovering: number;
  } {
    const transports = this.getAllTransports();
    return {
      total: transports.length,
      healthy: transports.filter(t => t.status === "idle" || t.status === "active").length,
      stalled: transports.filter(t => t.status === "stalled").length,
      recovering: transports.filter(t => t.status === "recovering").length,
    };
  }

  forceRecovery(transportName: string): void {
    const transport = this.transports.get(transportName);
    if (!transport) return;

    transport.status = "idle";
    transport.stallCount = 0;
    transport.lastActivity = new Date();
    
    logger.info(`[Watchdog] Force recovered: ${transportName}`);
  }
}

export const transportWatchdog = new TransportStallWatchdog();
