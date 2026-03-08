// ============================================================
// 🦀 Krab — Session Store (sessions.json management)
// ============================================================
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { SessionEntry } from "../channels/session.js";

export class SessionStore {
  private sessionsPath: string;
  private sessions: Map<string, SessionEntry> = new Map();

  constructor(sessionsDir: string = path.join(os.homedir(), ".krab", "sessions")) {
    this.sessionsPath = path.join(sessionsDir, "sessions.json");

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    this.loadSessions();
  }

  /**
   * Get or create a session entry
   */
  getOrCreateSession(sessionKey: string, initialData?: Partial<SessionEntry>): SessionEntry {
    let session = this.sessions.get(sessionKey);

    if (!session) {
      session = {
        sessionId: this.generateSessionId(),
        sessionKey,
        channel: initialData?.channel || "unknown",
        lastChannel: initialData?.lastChannel || initialData?.channel || "unknown",
        mode: initialData?.mode || "main",
        senderId: initialData?.senderId || "unknown",
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        queueMode: initialData?.queueMode || "sequential",
        replyBack: initialData?.replyBack ?? true,
        history: initialData?.history || [],
        ...initialData
      };

      this.sessions.set(sessionKey, session);
      this.saveSessions();
      logger.debug(`[SessionStore] Created session: ${session.sessionId} for key: ${sessionKey}`);
    }

    return session;
  }

  /**
   * Update session metadata
   */
  updateSession(sessionKey: string, updates: Partial<SessionEntry>): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      Object.assign(session, updates, { updatedAt: new Date() });
      this.saveSessions();
    }
  }

  /**
   * Increment message count for session
   */
  incrementMessageCount(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.messageCount++;
      session.updatedAt = new Date();
      this.saveSessions();
    }
  }

  /**
   * Get session by key
   */
  getSession(sessionKey: string): SessionEntry | undefined {
    return this.sessions.get(sessionKey);
  }

  setAgentId(sessionKey: string, agentId: string): void {
    this.updateSession(sessionKey, { agentId } as Partial<SessionEntry>);
  }

  getAgentId(sessionKey: string): string | undefined {
    const session = this.sessions.get(sessionKey) as (SessionEntry & { agentId?: string }) | undefined;
    return session?.agentId;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionEntry[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getTotalSessionCount(): number {
    return this.sessions.size;
  }

  getRecentSessions(limit = 5): SessionEntry[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Remove session
   */
  removeSession(sessionKey: string): boolean {
    const removed = this.sessions.delete(sessionKey);
    if (removed) {
      this.saveSessions();
      logger.debug(`[SessionStore] Removed session: ${sessionKey}`);
    }
    return removed;
  }

  /**
   * Get sessions count
   */
  getCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up old sessions (used by maintenance)
   */
  cleanup(removedSessionIds: string[]): void {
    for (const sessionId of removedSessionIds) {
      // Find session by sessionId
      for (const [key, session] of this.sessions.entries()) {
        if (session.sessionId === sessionId) {
          this.sessions.delete(key);
          break;
        }
      }
    }
    this.saveSessions();
  }

  private loadSessions(): void {
    if (!fs.existsSync(this.sessionsPath)) {
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.sessionsPath, "utf8"));

      for (const [key, value] of Object.entries(data)) {
        const entry = value as any;
        this.sessions.set(key, {
          ...entry,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        });
      }

      logger.debug(`[SessionStore] Loaded ${this.sessions.size} sessions`);

    } catch (error) {
      logger.warn("[SessionStore] Failed to load sessions:", error);
    }
  }

  private saveSessions(): void {
    try {
      const data: Record<string, any> = {};

      for (const [key, session] of this.sessions.entries()) {
        data[key] = {
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString()
        };
      }

      fs.writeFileSync(this.sessionsPath, JSON.stringify(data, null, 2));

    } catch (error) {
      logger.error("[SessionStore] Failed to save sessions:", error);
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();
