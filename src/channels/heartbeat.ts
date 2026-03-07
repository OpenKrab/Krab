// ============================================================
// 🦀 Krab — Heartbeat Monitoring System
// OpenClaw-inspired health checks for all subsystems
// ============================================================
import { logger } from "../utils/logger.js";

export interface HeartbeatConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  maxConsecutiveFailures: number;
}

export interface HeartbeatTarget {
  name: string;
  type: "channel" | "gateway" | "agent" | "plugin" | "transport";
  check: () => Promise<boolean>;
  onFailure?: () => void | Promise<void>;
  onRecovery?: () => void | Promise<void>;
}

export interface HeartbeatStatus {
  name: string;
  type: string;
  healthy: boolean;
  lastCheck: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
  totalChecks: number;
  totalFailures: number;
  avgResponseTime?: number;
}

export interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  targets: HeartbeatStatus[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
}

class HeartbeatMonitor {
  private config: HeartbeatConfig = {
    enabled: true,
    intervalMs: 30000,
    timeoutMs: 5000,
    maxConsecutiveFailures: 3,
  };

  private targets = new Map<string, HeartbeatTarget>();
  private status = new Map<string, HeartbeatStatus>();
  private intervalId: NodeJS.Timeout | null = null;
  private responseTimes: Map<string, number[]> = new Map();
  private startTime = Date.now();

  configure(config: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("[Heartbeat] Configuration updated:", this.config);
  }

  registerTarget(target: HeartbeatTarget): void {
    this.targets.set(target.name, target);
    this.status.set(target.name, {
      name: target.name,
      type: target.type,
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      totalChecks: 0,
      totalFailures: 0,
    });
    logger.info(`[Heartbeat] Registered target: ${target.name} (${target.type})`);
  }

  unregisterTarget(name: string): boolean {
    const removed = this.targets.delete(name);
    this.status.delete(name);
    this.responseTimes.delete(name);
    if (removed) {
      logger.info(`[Heartbeat] Unregistered target: ${name}`);
    }
    return removed;
  }

  start(): void {
    if (this.intervalId) {
      logger.warn("[Heartbeat] Already running");
      return;
    }

    if (!this.config.enabled) {
      logger.info("[Heartbeat] Disabled in config");
      return;
    }

    logger.info(`[Heartbeat] Starting with interval: ${this.config.intervalMs}ms`);
    
    this.intervalId = setInterval(() => {
      this.checkAll();
    }, this.config.intervalMs);

    this.checkAll();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[Heartbeat] Stopped");
    }
  }

  private async checkAll(): Promise<void> {
    const checks = Array.from(this.targets.entries()).map(async ([name, target]) => {
      await this.checkTarget(name, target);
    });

    await Promise.allSettled(checks);
  }

  private async checkTarget(name: string, target: HeartbeatTarget): Promise<void> {
    const status = this.status.get(name);
    if (!status) return;

    status.lastCheck = new Date();
    status.totalChecks++;

    const startTime = Date.now();

    try {
      const healthy = await this.withTimeout(
        target.check(),
        this.config.timeoutMs
      );

      const responseTime = Date.now() - startTime;
      this.recordResponseTime(name, responseTime);

      if (healthy) {
        if (!status.healthy && status.consecutiveFailures > 0) {
          logger.info(`[Heartbeat] ${name} recovered after ${status.consecutiveFailures} failures`);
          target.onRecovery?.();
        }
        status.healthy = true;
        status.lastSuccess = new Date();
        status.consecutiveFailures = 0;
      } else {
        status.healthy = false;
        status.lastFailure = new Date();
        status.consecutiveFailures++;
        status.totalFailures++;
        
        logger.warn(`[Heartbeat] ${name} check failed (consecutive: ${status.consecutiveFailures})`);
        
        if (status.consecutiveFailures >= this.config.maxConsecutiveFailures) {
          logger.error(`[Heartbeat] ${name} marked unhealthy after ${status.consecutiveFailures} failures`);
          target.onFailure?.();
        }
      }
    } catch (error) {
      status.healthy = false;
      status.lastFailure = new Date();
      status.consecutiveFailures++;
      status.totalFailures++;

      const responseTime = Date.now() - startTime;
      this.recordResponseTime(name, responseTime);

      logger.error(`[Heartbeat] ${name} error:`, error);

      if (status.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        target.onFailure?.();
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error("Heartbeat timeout")), ms)
      ),
    ]);
  }

  private recordResponseTime(name: string, time: number): void {
    let times = this.responseTimes.get(name);
    if (!times) {
      times = [];
      this.responseTimes.set(name, times);
    }
    times.push(time);
    if (times.length > 10) times.shift();

    const status = this.status.get(name);
    if (status && times.length > 0) {
      status.avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  getStatus(name: string): HeartbeatStatus | undefined {
    return this.status.get(name);
  }

  getAllStatus(): HeartbeatStatus[] {
    return Array.from(this.status.values());
  }

  getSystemHealth(): SystemHealth {
    const targets = this.getAllStatus();
    const healthy = targets.filter(t => t.healthy).length;
    const unhealthy = targets.filter(t => !t.healthy).length;

    let overall: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (unhealthy > 0) {
      overall = unhealthy >= targets.length ? "unhealthy" : "degraded";
    }

    return {
      overall,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      targets,
      summary: {
        total: targets.length,
        healthy,
        unhealthy,
      },
    };
  }

  getHealthSummary(): "healthy" | "degraded" | "unhealthy" {
    return this.getSystemHealth().overall;
  }
}

export const heartbeatMonitor = new HeartbeatMonitor();
