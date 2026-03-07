import type { BaseMessage, MultiModalMessage } from "./base.js";

export type SessionMode = "main" | "group" | "thread";
export type QueueMode = "sequential" | "parallel" | "batch";

export interface SessionMeta {
  sessionKey: string;
  sessionId?: string;
  channel: string;
  lastChannel: string;
  mode: SessionMode;
  groupId?: string;
  threadId?: string;
  senderId: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  queueMode: QueueMode;
  replyBack: boolean;
}

export interface GroupSessionConfig {
  requireMention?: boolean;
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  toolsBySender?: Record<string, {
    allow?: string[];
    deny?: string[];
    alsoAllow?: string[];
  }>;
  historyLimit?: number;
  isolation?: "shared" | "isolated";
}

export interface SessionEntry extends SessionMeta {
  groupConfig?: GroupSessionConfig;
  history: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
}

export function getChannelConversationId(name: string, message: BaseMessage, dmScope?: "main" | "per-channel-peer" | "per-account-channel-peer"): string {
  const threadId = (message.metadata as any)?.threadId;
  const isDM = !message.metadata?.groupId;
  
  // Apply DM scoping
  if (isDM && dmScope) {
    if (dmScope === "main") {
      // All DMs share the main session
      return `dm-main`;
    } else if (dmScope === "per-channel-peer") {
      // Isolate per channel + sender
      return `dm-${name}-${message.sender.id}`;
    } else if (dmScope === "per-account-channel-peer") {
      // For now, same as per-channel-peer since Krab doesn't have accounts
      return `dm-${name}-${message.sender.id}`;
    }
  }
  
  // Default behavior for groups or when dmScope is not set
  if (threadId) {
    return `${name}:${message.metadata?.groupId || message.sender.id}:${threadId}`;
  }
  return `${name}:${message.metadata?.groupId || message.sender.id}`;
}

export function getChannelReplyTarget(message: BaseMessage): string {
  return message.metadata?.groupId || message.sender.id;
}

export function buildAgentInput(message: BaseMessage): string {
  const parts: string[] = [];
  
  // Add context prefixes
  if (message.metadata?.groupName) {
    parts.push(`[From group: ${message.metadata.groupName}]`);
  }
  
  if (message.metadata?.replyTo) {
    parts.push(`[Replying to message: ${message.metadata.replyTo}]`);
  }

  const mentions = message.metadata?.mentions;
  if (mentions && mentions.length > 0) {
    parts.push(`[Mentions: ${mentions.join(", ")}]`);
  }

  const multimodal = message as MultiModalMessage;

  if (multimodal.transcription) {
    parts.push(`[Voice transcription]\n${multimodal.transcription}`);
  }

  parts.push(message.content);

  // Add sender info for context
  if (message.sender.displayName) {
    parts.push(`[From: ${message.sender.displayName}]`);
  }

  return parts.filter(Boolean).join("\n\n").trim();
}

export function normalizeSessionKey(sessionKey: string): string {
  return sessionKey.trim().toLowerCase();
}

export function buildSessionKey(channel: string, senderId: string, groupId?: string, threadId?: string): string {
  const parts = [channel];
  if (groupId) parts.push(`g:${groupId}`);
  else parts.push(`u:${senderId}`);
  if (threadId) parts.push(`t:${threadId}`);
  return parts.join("/");
}

export function parseSessionKey(sessionKey: string): {
  channel: string;
  groupId?: string;
  senderId: string;
  threadId?: string;
} | null {
  const parts = sessionKey.split("/");
  if (parts.length < 2) return null;
  
  const channel = parts[0];
  let groupId: string | undefined;
  let senderId: string;
  let threadId: string | undefined;
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("g:")) groupId = part.slice(2);
    else if (part.startsWith("t:")) threadId = part.slice(2);
    else senderId = part;
  }
  
  return { channel, groupId, senderId, threadId };
}

// ── Session Persistence ────────────────────────────────────────────
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SessionStoreConfig {
  storageDir?: string;
  maxSessions?: number;
}

export class SessionPersistence {
  private sessions: Map<string, SessionEntry> = new Map();
  private storagePath: string;
  private maxSessions: number;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(config: SessionStoreConfig = {}) {
    const dataDir = process.env.KRAB_DATA_DIR || "./data";
    this.storagePath = resolve(dataDir, "sessions");
    this.maxSessions = config.maxSessions || 500;
    this.ensureStorage();
    this.loadSessions();
  }

  private ensureStorage(): void {
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private getFilePath(sessionKey: string): string {
    const safeName = sessionKey.replace(/[^a-zA-Z0-9-_]/g, "_");
    return resolve(this.storagePath, `${safeName}.json`);
  }

  loadSessions(): void {
    try {
      if (!existsSync(this.storagePath)) {
        return;
      }

      const files = readdirSync(this.storagePath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = resolve(this.storagePath, file);
          const data = readFileSync(filePath, "utf-8");
          const entry = JSON.parse(data) as SessionEntry;
          
          // Convert date strings back to Date objects
          entry.createdAt = new Date(entry.createdAt);
          entry.updatedAt = new Date(entry.updatedAt);
          if (entry.history) {
            entry.history = entry.history.map(h => ({
              ...h,
              timestamp: new Date(h.timestamp)
            }));
          }
          
          this.sessions.set(entry.sessionKey, entry);
        }
      }
      console.log(`[SessionPersistence] Loaded ${this.sessions.size} sessions`);
    } catch (error) {
      console.error("[SessionPersistence] Failed to load sessions:", error);
    }
  }

  private saveSession(sessionKey: string): void {
    const entry = this.sessions.get(sessionKey);
    if (!entry) return;

    const filePath = this.getFilePath(sessionKey);
    try {
      writeFileSync(filePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      console.error(`[SessionPersistence] Failed to save session ${sessionKey}:`, error);
    }
  }

  private scheduleSave(sessionKey: string): void {
    // Debounce saves to avoid too many file writes
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.saveSession(sessionKey);
    }, 1000);
  }

  getSession(sessionKey: string): SessionEntry | undefined {
    const normalized = normalizeSessionKey(sessionKey);
    return this.sessions.get(normalized);
  }

  createOrUpdateSession(sessionKey: string, meta: Partial<SessionMeta>): SessionEntry {
    const normalized = normalizeSessionKey(sessionKey);
    let entry = this.sessions.get(normalized);

    if (!entry) {
      entry = {
        sessionKey: normalized,
        channel: meta.channel || "unknown",
        lastChannel: meta.channel || "unknown",
        mode: meta.mode || "main",
        groupId: meta.groupId,
        threadId: meta.threadId,
        senderId: meta.senderId || "unknown",
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        queueMode: meta.queueMode || "sequential",
        replyBack: meta.replyBack ?? true,
        history: []
      };
    } else {
      entry.updatedAt = new Date();
      if (meta.channel) entry.lastChannel = meta.channel;
      if (meta.mode) entry.mode = meta.mode;
      if (meta.queueMode) entry.queueMode = meta.queueMode;
      if (meta.replyBack !== undefined) entry.replyBack = meta.replyBack;
    }

    this.sessions.set(normalized, entry);
    this.pruneOldSessions();
    this.scheduleSave(normalized);

    return entry;
  }

  addMessageToHistory(sessionKey: string, role: "user" | "assistant", content: string): void {
    const normalized = normalizeSessionKey(sessionKey);
    const entry = this.sessions.get(normalized);
    
    if (!entry) return;

    if (!entry.history) {
      entry.history = [];
    }

    entry.history.push({
      role,
      content,
      timestamp: new Date()
    });

    entry.messageCount++;
    entry.updatedAt = new Date();

    // Trim history if too long
    const maxHistory = 100;
    if (entry.history.length > maxHistory) {
      entry.history = entry.history.slice(-maxHistory);
    }

    this.scheduleSave(normalized);
  }

  private pruneOldSessions(): void {
    if (this.sessions.size <= this.maxSessions) return;

    const sorted = Array.from(this.sessions.entries()).sort(
      ([, a], [, b]) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    const toRemove = sorted.slice(this.maxSessions);
    for (const [key] of toRemove) {
      this.sessions.delete(key);
      const filePath = this.getFilePath(key);
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore delete errors
      }
    }
    console.log(`[SessionPersistence] Pruned ${toRemove.length} old sessions`);
  }

  getAllSessions(): SessionEntry[] {
    return Array.from(this.sessions.values());
  }

  deleteSession(sessionKey: string): void {
    const normalized = normalizeSessionKey(sessionKey);
    this.sessions.delete(normalized);
    
    const filePath = this.getFilePath(sessionKey);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Ignore delete errors
    }
  }

  close(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    // Save all pending sessions
    for (const [key] of this.sessions) {
      this.saveSession(key);
    }
  }
}
