// ============================================================
// 🦀 Krab — Presence Tracker
// ============================================================
import * as os from "os";
import { logger } from "../utils/logger.js";

export interface PresenceEntry {
  instanceId?: string;
  host: string;
  ip?: string;
  version: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode: "ui" | "webchat" | "cli" | "backend" | "probe" | "test" | "node" | "gateway";
  lastInputSeconds?: number;
  reason: "self" | "connect" | "node-connected" | "periodic" | "beacon";
  ts: number; // timestamp
  agentId?: string; // for multi-agent
  channel?: string;
}

export interface PresenceUpdate {
  instanceId?: string;
  mode?: PresenceEntry["mode"];
  reason?: PresenceEntry["reason"];
  agentId?: string;
  channel?: string;
  lastInputSeconds?: number;
}

export class PresenceTracker {
  private entries = new Map<string, PresenceEntry>();
  private maxEntries = 100;
  private ttlMs = 5 * 60 * 1000; // 5 minutes default TTL

  constructor(maxEntries = 100, ttlMinutes = 5) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.startCleanupTimer();
  }

  /**
   * Update or create a presence entry
   */
  updatePresence(update: PresenceUpdate): PresenceEntry {
    const instanceId = update.instanceId || this.generateInstanceId();

    let entry = this.entries.get(instanceId);

    if (!entry) {
      entry = {
        instanceId,
        host: os.hostname(),
        ip: this.getLocalIP(),
        version: process.env.npm_package_version || "dev",
        deviceFamily: os.platform(),
        modelIdentifier: os.arch(),
        mode: update.mode || "cli",
        reason: update.reason || "self",
        ts: Date.now(),
        agentId: update.agentId,
        channel: update.channel
      };
    } else {
      // Update existing entry
      entry.ts = Date.now();
      if (update.mode) entry.mode = update.mode;
      if (update.reason) entry.reason = update.reason;
      if (update.agentId) entry.agentId = update.agentId;
      if (update.channel) entry.channel = update.channel;
      if (update.lastInputSeconds !== undefined) entry.lastInputSeconds = update.lastInputSeconds;
    }

    this.entries.set(instanceId, entry);

    // Enforce size limits
    this.enforceLimits();

    logger.debug(`[Presence] Updated presence for ${instanceId}: ${entry.mode} (${entry.reason})`);
    return entry;
  }

  /**
   * Get all active presence entries
   */
  getActivePresence(): PresenceEntry[] {
    const now = Date.now();
    return Array.from(this.entries.values())
      .filter(entry => now - entry.ts < this.ttlMs)
      .sort((a, b) => b.ts - a.ts);
  }

  /**
   * Get presence entry by instance ID
   */
  getPresence(instanceId: string): PresenceEntry | undefined {
    return this.entries.get(instanceId);
  }

  /**
   * Remove a presence entry
   */
  removePresence(instanceId: string): boolean {
    const removed = this.entries.delete(instanceId);
    if (removed) {
      logger.debug(`[Presence] Removed presence for ${instanceId}`);
    }
    return removed;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [instanceId, entry] of this.entries.entries()) {
      if (now - entry.ts >= this.ttlMs) {
        this.entries.delete(instanceId);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`[Presence] Cleaned up ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Update last input time for an instance
   */
  updateLastInput(instanceId: string): void {
    const entry = this.entries.get(instanceId);
    if (entry) {
      entry.lastInputSeconds = 0;
      entry.ts = Date.now();
    }
  }

  /**
   * Get presence statistics
   */
  getStats(): {
    total: number;
    active: number;
    byMode: Record<string, number>;
    byReason: Record<string, number>;
  } {
    const active = this.getActivePresence();
    const byMode: Record<string, number> = {};
    const byReason: Record<string, number> = {};

    for (const entry of active) {
      byMode[entry.mode] = (byMode[entry.mode] || 0) + 1;
      byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
    }

    return {
      total: this.entries.size,
      active: active.length,
      byMode,
      byReason
    };
  }

  private generateInstanceId(): string {
    return `krab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLocalIP(): string | undefined {
    try {
      const interfaces = os.networkInterfaces();
      for (const iface of Object.values(interfaces)) {
        if (!iface) continue;
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            return addr.address;
          }
        }
      }
    } catch (error) {
      logger.debug("[Presence] Could not determine local IP:", error);
    }
    return undefined;
  }

  private enforceLimits(): void {
    if (this.entries.size <= this.maxEntries) return;

    // Remove oldest entries
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => a[1].ts - b[1].ts);

    const toRemove = this.entries.size - this.maxEntries;
    for (let i = 0; i < toRemove; i++) {
      this.entries.delete(sorted[i][0]);
    }

    logger.debug(`[Presence] Enforced limit: removed ${toRemove} oldest entries`);
  }

  private startCleanupTimer(): void {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }
}

// Export singleton instance
export const presenceTracker = new PresenceTracker();
