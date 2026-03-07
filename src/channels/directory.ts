// ============================================================
// 🦀 Krab — Channel Directory/Contacts API
// ============================================================
import { logger } from "../utils/logger.js";

export type DirectoryEntryKind = "user" | "group" | "channel";

export interface DirectoryEntry {
  kind: DirectoryEntryKind;
  id: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
  rank?: number;
  raw?: unknown;
}

export interface DirectoryOptions {
  search?: string;
  limit?: number;
  offset?: number;
  kind?: DirectoryEntryKind;
}

export interface DirectoryResult {
  entries: DirectoryEntry[];
  total: number;
  hasMore: boolean;
}

export abstract class ChannelDirectory {
  protected channelName: string;

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  abstract listUsers(options?: DirectoryOptions): Promise<DirectoryResult>;
  abstract listGroups(options?: DirectoryOptions): Promise<DirectoryResult>;
  abstract searchContacts(query: string): Promise<DirectoryEntry[]>;
  abstract getUser(userId: string): Promise<DirectoryEntry | null>;
  abstract getGroup(groupId: string): Promise<DirectoryEntry | null>;

  protected log(method: string, ...args: unknown[]): void {
    logger.debug(`[${this.channelName}.Directory.${method}]`, ...args);
  }
}

// ── In-Memory Directory Cache ──────────────────────────────────
export class DirectoryCache {
  private users = new Map<string, DirectoryEntry>();
  private groups = new Map<string, DirectoryEntry>();
  private lastSync: Date | null = null;

  setUsers(entries: DirectoryEntry[]): void {
    this.users.clear();
    for (const entry of entries) {
      if (entry.kind === "user") {
        this.users.set(entry.id, entry);
      }
    }
    this.lastSync = new Date();
  }

  setGroups(entries: DirectoryEntry[]): void {
    this.groups.clear();
    for (const entry of entries) {
      if (entry.kind === "group") {
        this.groups.set(entry.id, entry);
      }
    }
    this.lastSync = new Date();
  }

  getUser(userId: string): DirectoryEntry | undefined {
    return this.users.get(userId);
  }

  getGroup(groupId: string): DirectoryEntry | undefined {
    return this.groups.get(groupId);
  }

  searchUsers(query: string): DirectoryEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.users.values()).filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.handle?.toLowerCase().includes(q) ||
        u.id.includes(q)
    );
  }

  searchGroups(query: string): DirectoryEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.groups.values()).filter(
      (g) =>
        g.name?.toLowerCase().includes(q) ||
        g.id.includes(q)
    );
  }

  getLastSync(): Date | null {
    return this.lastSync;
  }

  isStale(maxAgeMs = 5 * 60 * 1000): boolean {
    if (!this.lastSync) return true;
    return Date.now() - this.lastSync.getTime() > maxAgeMs;
  }

  clear(): void {
    this.users.clear();
    this.groups.clear();
    this.lastSync = null;
  }
}
