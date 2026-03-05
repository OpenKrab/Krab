// ============================================================
// 🦀 Krab — Plugin Types & Manifest Schema
// Everything a plugin author needs to know
// ============================================================
import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../core/types.js";

// ── Plugin Manifest Schema ──────────────────────────────────
export const PluginConfigFieldSchema = z.object({
  description: z.string(),
  required: z.boolean().optional().default(false),
  secret: z.boolean().optional().default(false),
  default: z.any().optional(),
});

export const PluginToolEntrySchema = z.object({
  name: z.string(),
  export: z.string().describe("Exported symbol name from the entry module"),
});

export const PluginChannelEntrySchema = z.object({
  name: z.string(),
  export: z.string(),
});

export const PluginAgentEntrySchema = z.object({
  name: z.string(),
  export: z.string(),
});

export const PluginMiddlewareEntrySchema = z.object({
  hook: z.enum([
    "beforeChat",
    "afterChat",
    "beforeTool",
    "afterTool",
    "onError",
    "onStart",
    "onShutdown",
  ]),
  export: z.string(),
  priority: z.number().optional().default(100),
});

export const PluginManifestSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-z0-9@][a-z0-9._\-/]*$/,
      "Plugin name must be lowercase with dashes/dots/slashes only",
    ),
  version: z.string().default("1.0.0"),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),

  krab: z.object({
    minVersion: z.string().optional(),
    type: z.enum(["tool", "channel", "agent", "middleware", "mixed"]),
    entry: z.string().default("./dist/index.js"),
    permissions: z
      .array(z.enum(["network", "filesystem", "shell", "browser", "system"]))
      .optional()
      .default([]),
    config: z.record(z.string(), PluginConfigFieldSchema).optional(),
  }),

  tools: z.array(PluginToolEntrySchema).optional().default([]),
  channels: z.array(PluginChannelEntrySchema).optional().default([]),
  agents: z.array(PluginAgentEntrySchema).optional().default([]),
  middleware: z.array(PluginMiddlewareEntrySchema).optional().default([]),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginConfigField = z.infer<typeof PluginConfigFieldSchema>;
export type PluginToolEntry = z.infer<typeof PluginToolEntrySchema>;

// ── Plugin Instance (runtime) ───────────────────────────────
export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  module: Record<string, any> | null;
  status: "loaded" | "error" | "disabled";
  error?: string;
  loadedAt: Date;
  registeredTools: string[];
  registeredChannels: string[];
  registeredAgents: string[];
}

// ── Middleware Types ────────────────────────────────────────
export interface MiddlewareContext {
  /** User input (for chat hooks) */
  input?: string;
  /** Agent output (for afterChat) */
  output?: string;
  /** Tool name (for tool hooks) */
  toolName?: string;
  /** Tool arguments (for tool hooks) */
  toolArgs?: Record<string, unknown>;
  /** Tool result (for afterTool) */
  toolResult?: ToolResult;
  /** Error (for onError) */
  error?: Error;
  /** Arbitrary metadata for middleware to share */
  metadata: Record<string, any>;
}

export type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: () => Promise<void>,
) => Promise<void>;

export interface MiddlewareEntry {
  hook: string;
  fn: MiddlewareFn;
  priority: number;
  pluginName: string;
}

// ── Channel Types ───────────────────────────────────────────
/** A message received from a channel (Telegram, WA, etc.) */
export interface ChannelMessage {
  id: string;
  sessionId: string;
  sender: {
    id: string;
    name?: string;
    handle?: string;
  };
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/** A response to be sent back through a channel */
export interface ChannelResponse {
  content: string;
  media?: {
    type: "image" | "audio" | "document" | "video";
    url: string;
    filename?: string;
    caption?: string;
  }[];
}

/** Interface for building communication platform plugins */
export interface Channel {
  name: string;
  platform: string;
  /** Initialize and start the connection (e.g., connect to Telegram API) */
  start: (config: Record<string, any>) => Promise<void>;
  /** Stop the connection */
  stop: () => Promise<void>;
  /** Register a callback for incoming messages */
  onMessage: (
    handler: (msg: ChannelMessage) => Promise<ChannelResponse | void>,
  ) => void;
  /** Proactively send a message to a specific target */
  sendMessage: (targetId: string, response: ChannelResponse) => Promise<void>;
}

// ── Plugin Registry File ────────────────────────────────────
export interface PluginRegistryEntry {
  version: string;
  path: string;
  enabled: boolean;
  installedAt: string;
  source: "local" | "npm" | "git" | "manual";
}

export interface PluginRegistryFile {
  version: number;
  installed: Record<string, PluginRegistryEntry>;
}

// ── Re-export core types for plugin authors ─────────────────
export type { ToolDefinition, ToolResult };
