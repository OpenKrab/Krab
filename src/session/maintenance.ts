// ============================================================
// 🦀 Krab — Session Maintenance (Pruning, Archiving, Cleanup)
// ============================================================
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface MaintenanceConfig {
  mode: "warn" | "enforce";
  pruneAfter: string; // e.g., "30d"
  maxEntries: number;
  rotateBytes: string; // e.g., "10mb"
  resetArchiveRetention: string;
  maxDiskBytes?: string;
  highWaterBytes?: string;
}

export interface MaintenanceSessionEntry {
  sessionId: string;
  sessionKey: string;
  updatedAt: Date;
  displayName?: string;
  channel?: string;
  subject?: string;
  room?: string;
  space?: string;
  origin?: {
    label: string;
    routingHints: any;
  };
}

export class SessionMaintenance {
  private config: MaintenanceConfig;
  private sessionsDir: string;
  private sessionsPath: string;

  constructor(config: MaintenanceConfig, sessionsDir: string = path.join(os.homedir(), ".krab", "sessions")) {
    this.config = config;
    this.sessionsDir = sessionsDir;
    this.sessionsPath = path.join(sessionsDir, "sessions.json");

    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Run maintenance cleanup
   */
  async cleanup(dryRun: boolean = false): Promise<{
    pruned: number;
    archived: number;
    rotated: boolean;
    diskFreed: number;
    warnings: string[];
  }> {
    const result = {
      pruned: 0,
      archived: 0,
      rotated: false,
      diskFreed: 0,
      warnings: [] as string[]
    };

    try {
      const sessions = this.loadSessions();

      if (this.config.mode === "warn") {
        result.warnings = this.analyzeCleanup(sessions);
        return result;
      }

      // Enforce cleanup
      result.pruned = this.pruneStaleSessions(sessions, dryRun);
      result.pruned += this.capSessionCount(sessions, dryRun);
      result.archived = this.archiveTranscripts(sessions, dryRun);
      this.purgeOldArchives(dryRun);
      result.rotated = this.rotateSessionsFile(sessions, dryRun);
      result.diskFreed = this.enforceDiskBudget(dryRun);

    } catch (error) {
      logger.error("[SessionMaintenance] Cleanup failed:", error);
      result.warnings.push(`Cleanup failed: ${error}`);
    }

    return result;
  }

  private loadSessions(): MaintenanceSessionEntry[] {
    if (!fs.existsSync(this.sessionsPath)) {
      return [];
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.sessionsPath, "utf8"));
      return Object.values(data).map((entry: any) => ({
        ...entry,
        updatedAt: new Date(entry.updatedAt)
      }));
    } catch (error) {
      logger.warn("[SessionMaintenance] Failed to load sessions.json:", error);
      return [];
    }
  }

  private analyzeCleanup(sessions: MaintenanceSessionEntry[]): string[] {
    const warnings: string[] = [];
    const now = new Date();

    // Analyze pruning
    const pruneThreshold = this.parseDuration(this.config.pruneAfter);
    const staleCount = sessions.filter(s => now.getTime() - s.updatedAt.getTime() > pruneThreshold).length;
    if (staleCount > 0) {
      warnings.push(`${staleCount} sessions older than ${this.config.pruneAfter} would be pruned`);
    }

    // Analyze capping
    if (sessions.length > this.config.maxEntries) {
      warnings.push(`${sessions.length - this.config.maxEntries} sessions would be removed to cap at ${this.config.maxEntries}`);
    }

    return warnings;
  }

  private pruneStaleSessions(sessions: MaintenanceSessionEntry[], dryRun: boolean): number {
    const now = new Date();
    const pruneThreshold = this.parseDuration(this.config.pruneAfter);
    const staleSessions = sessions.filter(s => now.getTime() - s.updatedAt.getTime() > pruneThreshold);

    if (dryRun) return staleSessions.length;

    for (const session of staleSessions) {
      // Remove from sessions
      sessions.splice(sessions.indexOf(session), 1);
      logger.debug(`[SessionMaintenance] Pruned stale session: ${session.sessionId}`);
    }

    this.saveSessions(sessions);
    return staleSessions.length;
  }

  private capSessionCount(sessions: MaintenanceSessionEntry[], dryRun: boolean): number {
    if (sessions.length <= this.config.maxEntries) return 0;

    const toRemove = sessions.length - this.config.maxEntries;
    const sortedByAge = sessions.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    const sessionsToRemove = sortedByAge.slice(0, toRemove);

    if (dryRun) return toRemove;

    for (const session of sessionsToRemove) {
      sessions.splice(sessions.indexOf(session), 1);
      logger.debug(`[SessionMaintenance] Capped session: ${session.sessionId}`);
    }

    this.saveSessions(sessions);
    return toRemove;
  }

  private archiveTranscripts(sessions: MaintenanceSessionEntry[], dryRun: boolean): number {
    // In Krab, transcripts are managed by conversation memory
    // For now, just count
    return 0;
  }

  private purgeOldArchives(dryRun: boolean): void {
    // Implement archive purging logic
    // For now, placeholder
  }

  private rotateSessionsFile(sessions: MaintenanceSessionEntry[], dryRun: boolean): boolean {
    if (!fs.existsSync(this.sessionsPath)) return false;

    const stats = fs.statSync(this.sessionsPath);
    const rotateThreshold = this.parseSize(this.config.rotateBytes);

    if (stats.size < rotateThreshold) return false;

    if (dryRun) return true;

    // Rotate the file
    const backupPath = `${this.sessionsPath}.${Date.now()}.backup`;
    fs.copyFileSync(this.sessionsPath, backupPath);
    logger.info(`[SessionMaintenance] Rotated sessions.json (${stats.size} bytes)`);

    return true;
  }

  private enforceDiskBudget(dryRun: boolean): number {
    if (!this.config.maxDiskBytes) return 0;

    // Implement disk budget enforcement
    // For now, placeholder
    return 0;
  }

  private saveSessions(sessions: MaintenanceSessionEntry[]): void {
    try {
      const data: Record<string, any> = {};

      for (const session of sessions) {
        data[session.sessionKey] = {
          ...session,
          updatedAt: session.updatedAt.toISOString()
        };
      }

      fs.writeFileSync(this.sessionsPath, JSON.stringify(data, null, 2));

    } catch (error) {
      logger.error("[SessionMaintenance] Failed to save sessions:", error);
    }
  }

  private parseDuration(duration: string): number {
    // Simple duration parser: "30d" -> 30 days in ms
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit as keyof typeof multipliers] || multipliers.d);
  }

  private parseSize(size: string): number {
    // Simple size parser: "10mb" -> 10MB in bytes
    const match = size.match(/^(\d+)([kmg]b?)$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      k: 1024,
      kb: 1024,
      m: 1024 * 1024,
      mb: 1024 * 1024,
      g: 1024 * 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };

    return value * (multipliers[unit as keyof typeof multipliers] || multipliers.mb);
  }
}
