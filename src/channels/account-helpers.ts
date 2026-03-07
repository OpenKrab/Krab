// ============================================================
// 🦀 Krab — Account Helpers
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";

export type AccountState = 
  | "unconfigured"
  | "configured"
  | "linking"
  | "linked"
  | "running"
  | "stopped"
  | "error";

export interface AccountInfo {
  id: string;
  name?: string;
  state: AccountState;
  channel: string;
  lastConnectedAt?: Date;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountSnapshot {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  linked: boolean;
  running: boolean;
  connected: boolean;
  busy?: boolean;
  activeRuns?: number;
  lastConnectedAt?: number | null;
  lastDisconnect?: string | null;
  lastError?: string | null;
  dmPolicy?: string;
  allowFrom?: string[];
}

export class AccountHelpers {
  private accounts = new Map<string, AccountInfo>();

  register(account: AccountInfo): void {
    this.accounts.set(account.id, account);
    logger.debug(`[AccountHelpers] Registered account: ${account.id} (${account.channel})`);
  }

  unregister(accountId: string): boolean {
    const removed = this.accounts.delete(accountId);
    if (removed) {
      logger.debug(`[AccountHelpers] Unregistered account: ${accountId}`);
    }
    return removed;
  }

  get(accountId: string): AccountInfo | undefined {
    return this.accounts.get(accountId);
  }

  getAll(): AccountInfo[] {
    return Array.from(this.accounts.values());
  }

  getByChannel(channel: string): AccountInfo[] {
    return Array.from(this.accounts.values()).filter((a) => a.channel === channel);
  }

  getByState(state: AccountState): AccountInfo[] {
    return Array.from(this.accounts.values()).filter((a) => a.state === state);
  }

  updateState(accountId: string, state: AccountState, metadata?: Record<string, unknown>): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.state = state;
      account.lastConnectedAt = state === "running" ? new Date() : account.lastConnectedAt;
      if (metadata) {
        account.metadata = { ...account.metadata, ...metadata };
      }
      logger.debug(`[AccountHelpers] Account ${accountId} state: ${state}`);
    }
  }

  setError(accountId: string, error: string): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.state = "error";
      account.lastError = error;
      logger.warn(`[AccountHelpers] Account ${accountId} error: ${error}`);
    }
  }

  isReady(accountId: string): boolean {
    const account = this.accounts.get(accountId);
    return account?.state === "running" || account?.state === "linked";
  }

  getSnapshot(accountId: string): AccountSnapshot | null {
    const account = this.accounts.get(accountId);
    if (!account) return null;

    return {
      accountId: account.id,
      name: account.name,
      enabled: true,
      configured: account.state !== "unconfigured",
      linked: account.state === "linked" || account.state === "running",
      running: account.state === "running",
      connected: account.state === "running",
      lastConnectedAt: account.lastConnectedAt?.getTime() || null,
      lastError: account.lastError || null,
      dmPolicy: (account.metadata?.dmPolicy as string) || "open",
    };
  }

  getAllSnapshots(): AccountSnapshot[] {
    return Array.from(this.accounts.keys()).map((id) => this.getSnapshot(id)).filter(Boolean) as AccountSnapshot[];
  }
}

// ── Account Action Gate ─────────────────────────────────────────

export type AccountAction = "start" | "stop" | "restart" | "configure" | "unlink";

export interface AccountActionGateConfig {
  allowConcurrent: boolean;
  cooldownMs: number;
}

export class AccountActionGate {
  private inProgress = new Set<string>();
  private lastAction = new Map<string, number>();
  private config: AccountActionGateConfig;

  constructor(config: Partial<AccountActionGateConfig> = {}) {
    this.config = {
      allowConcurrent: config.allowConcurrent ?? false,
      cooldownMs: config.cooldownMs ?? 5000,
    };
  }

  async tryAction<T>(accountId: string, action: AccountAction, fn: () => Promise<T>): Promise<T> {
    if (!this.config.allowConcurrent && this.inProgress.has(accountId)) {
      throw new Error(`Account ${accountId} has action in progress`);
    }

    const lastActionTime = this.lastAction.get(accountId) || 0;
    if (Date.now() - lastActionTime < this.config.cooldownMs) {
      throw new Error(`Account ${accountId} action on cooldown`);
    }

    this.inProgress.add(accountId);
    this.lastAction.set(accountId, Date.now());

    try {
      return await fn();
    } finally {
      this.inProgress.delete(accountId);
    }
  }

  isInProgress(accountId: string): boolean {
    return this.inProgress.has(accountId);
  }

  getInProgress(): string[] {
    return Array.from(this.inProgress);
  }
}

// ── Account Config Helpers ─────────────────────────────────────

export const AccountConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("open"),
  allowFrom: z.array(z.string()).default([]),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).default("open"),
  groupAllowFrom: z.array(z.string()).default([]),
  mediaMaxMb: z.number().positive().default(25),
  groups: z.record(z.string(), z.object({
    requireMention: z.boolean().optional(),
    tools: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
  })).optional(),
});

export type AccountConfig = z.infer<typeof AccountConfigSchema>;

export function normalizeAccountConfig(config: Partial<AccountConfig>): AccountConfig {
  return AccountConfigSchema.parse(config);
}

export function resolveDmPolicy(config: AccountConfig): string {
  return config.dmPolicy;
}

export function resolveAllowFrom(config: AccountConfig): string[] {
  if (config.dmPolicy === "open") {
    return ["*"];
  }
  return config.allowFrom;
}
