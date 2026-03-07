import type { BaseMessage, ChannelConfig } from "./base.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

export function shouldAllowChannelMessage(
  config: ChannelConfig,
  message: BaseMessage,
  isPaired: (senderId: string) => boolean,
): boolean {
  if (!message.metadata?.groupId) {
    return checkDmPolicy(config, message.sender.id, isPaired);
  }

  return checkGroupPolicy(config, message);
}

export function checkDmPolicy(
  config: ChannelConfig,
  senderId: string,
  isPaired: (senderId: string) => boolean,
): boolean {
  switch (config.dmPolicy) {
    case "open":
      return config.allowFrom?.includes("*") || false;
    case "allowlist":
      return config.allowFrom?.includes(senderId) || false;
    case "pairing":
      return isPaired(senderId);
    case "disabled":
    default:
      return false;
  }
}

export function checkGroupPolicy(
  config: ChannelConfig,
  message: BaseMessage,
): boolean {
  if (!message.metadata?.groupId) return false;

  const groupConfig =
    config.groups?.[message.metadata.groupId] || config.groups?.["*"];

  if (!groupConfig) return false;

  if (config.groupPolicy === "allowlist") {
    const groupAllowed =
      config.groupAllowFrom?.includes(message.sender.id) ||
      config.groupAllowFrom?.includes("*");
    if (!groupAllowed) return false;
  }

  if (groupConfig.requireMention) {
    const mentions = message.metadata.mentions || [];
    const hasMention = mentions.some(
      (mention) => mention.includes("krab") || mention.includes("openclaw"),
    );
    if (!hasMention) return false;
  }

  return true;
}

// ── Command Gating ──────────────────────────────────────────────

export interface CommandRule {
  command: string;
  allowedRoles?: string[];
  allowedUsers?: string[];
  requireMention?: boolean;
  cooldown?: number;
  maxUses?: number;
}

export interface CommandGatingConfig {
  rules: CommandRule[];
  defaultRequireMention: boolean;
  defaultCooldown: number;
}

export class CommandGating {
  private config: CommandGatingConfig;
  private cooldowns = new Map<string, number>();
  private usageCounts = new Map<string, number>();

  constructor(config: CommandGatingConfig) {
    this.config = config;
  }

  canExecute(
    command: string,
    senderId: string,
    roles: string[] = [],
    mentioned: boolean = false,
  ): { allowed: boolean; reason?: string } {
    const rule = this.config.rules.find((r) => r.command === command);
    
    if (!rule) {
      return { allowed: true };
    }

    if (rule.allowedUsers?.includes(senderId)) {
      return { allowed: true };
    }

    if (rule.allowedRoles && rule.allowedRoles.length > 0) {
      const hasRole = roles.some((role) => rule.allowedRoles!.includes(role));
      if (!hasRole) {
        return { allowed: false, reason: "Insufficient permissions" };
      }
    }

    const requireMention = rule.requireMention ?? this.config.defaultRequireMention;
    if (requireMention && !mentioned) {
      return { allowed: false, reason: "Bot must be mentioned" };
    }

    if (rule.cooldown ?? this.config.defaultCooldown) {
      const cooldownMs = (rule.cooldown ?? this.config.defaultCooldown) * 1000;
      const key = `${command}:${senderId}`;
      const lastExecute = this.cooldowns.get(key);
      
      if (lastExecute && Date.now() - lastExecute < cooldownMs) {
        return { allowed: false, reason: "Cooldown active" };
      }
    }

    if (rule.maxUses) {
      const key = `${command}:${senderId}`;
      const uses = this.usageCounts.get(key) || 0;
      if (uses >= rule.maxUses) {
        return { allowed: false, reason: "Max uses exceeded" };
      }
    }

    return { allowed: true };
  }

  recordExecution(command: string, senderId: string): void {
    const key = `${command}:${senderId}`;
    this.cooldowns.set(key, Date.now());
    
    const uses = this.usageCounts.get(key) || 0;
    this.usageCounts.set(key, uses + 1);
  }
}

// ── Pairing System ───────────────────────────────────────────────

export interface PairingCode {
  code: string;
  senderId: string;
  channel: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

interface PairingStore {
  pairedUsers: string[];
  pendingCodes: PairingCode[];
}

export class PairingManager {
  private pendingCodes = new Map<string, PairingCode>();
  private pairedUsers = new Set<string>();
  private storagePath: string;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(storageDir?: string) {
    const dataDir = process.env.KRAB_DATA_DIR || "./data";
    this.storagePath = resolve(dataDir, "pairing.json");
    this.ensureStorage();
    this.loadPairedUsers();
  }

  private ensureStorage(): void {
    const dir = dirname(this.storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private resolve(path: string): string {
    return resolve(path);
  }

  private dirname(path: string): string {
    return dirname(path);
  }

  private loadPairedUsers(): void {
    try {
      if (existsSync(this.storagePath)) {
        const data = readFileSync(this.storagePath, "utf-8");
        const store = JSON.parse(data) as PairingStore;
        
        if (store.pairedUsers) {
          for (const key of store.pairedUsers) {
            this.pairedUsers.add(key);
          }
        }
        
        console.log(`[PairingManager] Loaded ${this.pairedUsers.size} paired users`);
      }
    } catch (error) {
      console.error("[PairingManager] Failed to load paired users:", error);
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.savePairedUsers();
    }, 1000);
  }

  private savePairedUsers(): void {
    try {
      const store: PairingStore = {
        pairedUsers: Array.from(this.pairedUsers),
        pendingCodes: Array.from(this.pendingCodes.values())
      };
      writeFileSync(this.storagePath, JSON.stringify(store, null, 2));
    } catch (error) {
      console.error("[PairingManager] Failed to save paired users:", error);
    }
  }

  generateCode(senderId: string, channel: string, ttlMinutes = 5): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date();
    
    const pairing: PairingCode = {
      code,
      senderId,
      channel,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
      used: false,
    };

    this.pendingCodes.set(code, pairing);
    return code;
  }

  verifyCode(code: string, senderId: string): boolean {
    const pairing = this.pendingCodes.get(code);
    
    if (!pairing) return false;
    if (pairing.used) return false;
    if (new Date() > pairing.expiresAt) {
      this.pendingCodes.delete(code);
      return false;
    }

    if (pairing.senderId !== senderId) return false;

    pairing.used = true;
    this.pairedUsers.add(`${pairing.channel}:${senderId}`);
    this.scheduleSave();
    return true;
  }

  isPaired(channel: string, senderId: string): boolean {
    return this.pairedUsers.has(`${channel}:${senderId}`);
  }

  unpair(channel: string, senderId: string): void {
    this.pairedUsers.delete(`${channel}:${senderId}`);
    this.scheduleSave();
  }

  getPairedUsers(channel: string): string[] {
    const prefix = `${channel}:`;
    return Array.from(this.pairedUsers)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  cleanup(): void {
    const now = new Date();
    for (const [code, pairing] of this.pendingCodes) {
      if (now > pairing.expiresAt) {
        this.pendingCodes.delete(code);
      }
    }
  }

  close(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.savePairedUsers();
  }
}

// ── Allowlist Matcher ─────────────────────────────────────────────

export class AllowlistMatcher {
  private entries: string[];

  constructor(entries: string[]) {
    this.entries = entries.map((e) => e.trim().toLowerCase()).filter(Boolean);
  }

  matches(senderId: string): boolean {
    const normalized = senderId.trim().toLowerCase();
    
    if (this.entries.includes("*")) return true;
    if (this.entries.includes(normalized)) return true;
    
    for (const entry of this.entries) {
      if (entry.startsWith("*@") && normalized.endsWith(entry.slice(1))) {
        return true;
      }
      if (entry.includes("*")) {
        const regex = new RegExp("^" + entry.replace(/\*/g, ".*") + "$");
        if (regex.test(normalized)) return true;
      }
    }
    
    return false;
  }

  add(entry: string): void {
    const normalized = entry.trim().toLowerCase();
    if (!this.entries.includes(normalized)) {
      this.entries.push(normalized);
    }
  }

  remove(entry: string): void {
    const normalized = entry.trim().toLowerCase();
    this.entries = this.entries.filter((e) => e !== normalized);
  }

  getEntries(): string[] {
    return [...this.entries];
  }
}
