// ============================================================
// 🦀 Krab — Channel Config Schema
// ============================================================
import { z } from "zod";
import { logger } from "../utils/logger.js";

// ── Core Config ─────────────────────────────────────────────────
export const GroupConfigSchema = z.object({
  requireMention: z.boolean().default(false),
  tools: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  toolsBySender: z.record(z.string(), z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    alsoAllow: z.array(z.string()).optional(),
  })).optional(),
  historyLimit: z.number().int().positive().optional(),
  isolation: z.enum(["shared", "isolated"]).default("shared"),
  replyMode: z.enum(["off", "first", "all"]).default("first"),
});

export const ChannelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("open"),
  allowFrom: z.array(z.string()).default([]),
  allowBots: z.boolean().default(false),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).default("open"),
  groupAllowFrom: z.array(z.string()).default([]),
  webhookPath: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  mediaMaxMb: z.number().positive().max(100).default(25),
  mediaAllowedTypes: z.array(z.enum(["image", "audio", "video", "file"])).default(["image", "audio", "video", "file"]),
  groups: z.record(z.string(), GroupConfigSchema).optional(),
  typingTimeoutMs: z.number().positive().default(10000),
  messageTimeoutMs: z.number().positive().default(60000),
  maxRetries: z.number().int().min(0).max(5).default(3),
  retryDelayMs: z.number().positive().default(1000),
  historyLimit: z.number().int().positive().default(100),
  sessionTimeoutMinutes: z.number().int().positive().default(30),
  commandPrefix: z.string().default("/"),
  mentionNames: z.array(z.string()).default(["krab", "bot", "assistant"]),
});

// ── Channel-Specific Config ────────────────────────────────────

export const TelegramConfigSchema = ChannelConfigSchema.extend({
  botToken: z.string().optional(),
  botTokenFile: z.string().optional(),
  apiUrl: z.string().url().optional(),
  adminIds: z.array(z.string()).default([]),
  commands: z.array(z.object({
    command: z.string(),
    description: z.string(),
  })).default([]),
});

export const DiscordConfigSchema = ChannelConfigSchema.extend({
  botToken: z.string().optional(),
  botTokenFile: z.string().optional(),
  appToken: z.string().optional(),
  guildId: z.string().optional(),
  channelMappings: z.record(z.string(), z.string()).optional(),
  webhookUrl: z.string().url().optional(),
});

export const LINEConfigSchema = ChannelConfigSchema.extend({
  channelAccessToken: z.string().optional(),
  channelAccessTokenFile: z.string().optional(),
  channelSecret: z.string().optional(),
  channelSecretFile: z.string().optional(),
  richMenuId: z.string().optional(),
  autoReply: z.boolean().default(false),
});

export const WhatsAppConfigSchema = ChannelConfigSchema.extend({
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  accessTokenFile: z.string().optional(),
  businessAccountId: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  mediaStorage: z.enum(["local", "cloud"]).default("local"),
});

export const SlackConfigSchema = ChannelConfigSchema.extend({
  botToken: z.string().optional(),
  botTokenFile: z.string().optional(),
  appToken: z.string().optional(),
  signingSecret: z.string().optional(),
  socketMode: z.boolean().default(true),
  channelMappings: z.record(z.string(), z.string()).optional(),
});

export const SignalConfigSchema = ChannelConfigSchema.extend({
  signalNumber: z.string().optional(),
  cliPath: z.string().optional(),
  dbPath: z.string().optional(),
  service: z.enum(["imessage", "sms", "auto"]).default("auto"),
  region: z.string().optional(),
});

// ── Types ───────────────────────────────────────────────────────
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
export type GroupConfig = z.infer<typeof GroupConfigSchema>;
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;
export type LINEConfig = z.infer<typeof LINEConfigSchema>;
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;
export type SlackConfig = z.infer<typeof SlackConfigSchema>;
export type SignalConfig = z.infer<typeof SignalConfigSchema>;

// ── Config Parser ──────────────────────────────────────────────

const configParsers: Record<string, z.ZodSchema> = {
  telegram: TelegramConfigSchema,
  discord: DiscordConfigSchema,
  line: LINEConfigSchema,
  whatsapp: WhatsAppConfigSchema,
  slack: SlackConfigSchema,
  signal: SignalConfigSchema,
  default: ChannelConfigSchema,
};

export function getConfigParser(channel: string): z.ZodSchema {
  return configParsers[channel.toLowerCase()] || configParsers.default;
}

export function parseChannelConfig(channel: string, config: unknown): ChannelConfig {
  const parser = getConfigParser(channel);
  return parser.parse(config);
}

export function validateChannelConfig(channel: string, config: unknown): {
  success: boolean;
  data?: ChannelConfig;
  error?: string;
} {
  try {
    const parser = getConfigParser(channel);
    const data = parser.parse(config);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") };
    }
    return { success: false, error: String(error) };
  }
}

export function mergeConfig(base: ChannelConfig, overrides: Partial<ChannelConfig>): ChannelConfig {
  return {
    ...base,
    ...overrides,
    allowFrom: [...new Set([...base.allowFrom, ...(overrides.allowFrom || [])])],
    groupAllowFrom: [...new Set([...base.groupAllowFrom, ...(overrides.groupAllowFrom || [])])],
  };
}

// ── Config Helpers ─────────────────────────────────────────────

export function resolveGroupConfig(
  config: ChannelConfig,
  groupId: string
): GroupConfig | undefined {
  return config.groups?.[groupId] || config.groups?.["*"];
}

export function resolveToolsPolicy(
  config: ChannelConfig,
  groupId: string,
  senderId?: string
): { allow: string[]; deny: string[] } {
  const groupConfig = resolveGroupConfig(config, groupId);
  
  if (!groupConfig?.tools) {
    return { allow: [], deny: [] };
  }

  let allow = groupConfig.tools.allow || [];
  let deny = groupConfig.tools.deny || [];

  if (senderId && groupConfig.toolsBySender?.[senderId]) {
    const senderConfig = groupConfig.toolsBySender[senderId];
    if (senderConfig.allow) allow = [...allow, ...senderConfig.allow];
    if (senderConfig.deny) deny = [...deny, ...senderConfig.deny];
    if (senderConfig.alsoAllow) allow = [...allow, ...senderConfig.alsoAllow];
  }

  return { allow, deny };
}

export function shouldRequireMention(config: ChannelConfig, groupId: string): boolean {
  const groupConfig = resolveGroupConfig(config, groupId);
  return groupConfig?.requireMention ?? false;
}
