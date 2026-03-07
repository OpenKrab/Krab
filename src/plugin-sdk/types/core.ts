// ============================================================
// 🦀 Krab — Plugin SDK: Core Types
// Additional types for plugins
// ============================================================
import type { ToolDefinition } from "../../core/types.js";
import type { ChannelPlugin } from "./adapters.js";

// Re-export for convenience
export type { ToolDefinition } from "../../core/types.js";

// ── Message Action Types ─────────────────────────────────────
export type MessageActionName =
  | "react"
  | "reply"
  | "edit"
  | "delete"
  | "forward"
  | "pin"
  | "unpin"
  | "search"
  | "reply-react";

export const CHANNEL_MESSAGE_ACTION_NAMES: MessageActionName[] = [
  "react",
  "reply",
  "edit",
  "delete",
  "forward",
  "pin",
  "unpin",
  "search",
  "reply-react",
];

// ── Account Types ─────────────────────────────────────────────
export interface ChannelAccountState {
  id: string;
  displayName: string;
  username?: string;
  isBot: boolean;
  status?: "connected" | "disconnected" | "error";
}

export interface ChannelAccountSnapshot {
  channelId: string;
  accounts: ChannelAccountState[];
  timestamp: Date;
}

// ── Token Resolution ─────────────────────────────────────────
export interface BaseTokenResolution {
  userId: string;
  channelId: string;
}

// ── Probe Result ─────────────────────────────────────────────
export interface BaseProbeResult {
  ok: boolean;
  latency?: number;
  error?: string;
  version?: string;
}

// ── Message Action Context ───────────────────────────────────
export interface ChannelMessageActionContext {
  messageId: string;
  channelId: string;
  sender: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ── Config Schema ─────────────────────────────────────────────
export interface ChannelConfigSchema {
  type: "object";
  properties: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
    default?: any;
    secret?: boolean;
  }>;
  required?: string[];
}

// ── Plugin API ────────────────────────────────────────────────
export interface OpenClawPluginApi {
  name: string;
  version: string;
  init(config: any): Promise<void>;
  getChannels(): ChannelPlugin[];
  getTools(): ToolDefinition[];
}

export interface OpenClawPluginConfigSchema {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
}
