// ============================================================
// 🦀 Krab — Plugin SDK: Adapter Types
// Interfaces that channel plugins must implement
// ============================================================

import type { ToolDefinition, ToolResult } from "../../core/types.js";

export type { ToolDefinition, ToolResult } from "../../core/types.js";

// ── Channel ID ───────────────────────────────────────────────
export type ChannelId = string;

// ── Channel Capabilities ──────────────────────────────────────
export interface ChannelCapabilities {
  /** Can send/poll messages */
  messaging: boolean;
  /** Can create and manage groups */
  groupManagement: boolean;
  /** Can send reactions */
  reactions: boolean;
  /** Can edit messages */
  edit: boolean;
  /** Can delete/unsend messages */
  unsend: boolean;
  /** Can reply to messages */
  reply: boolean;
  /** Can send media (images, video, audio) */
  media: boolean;
  /** Can send buttons/interactive messages */
  buttons: boolean;
  /** Can send carousels/lists */
  carousels: boolean;
  /** Can create polls */
  polls: boolean;
  /** Can handle threads */
  threads: boolean;
  /** Can handle voice messages */
  voiceMessages: boolean;
  /** Has native slash commands */
  nativeCommands: boolean;
}

export const DEFAULT_CAPABILITIES: ChannelCapabilities = {
  messaging: true,
  groupManagement: false,
  reactions: false,
  edit: false,
  unsend: false,
  reply: true,
  media: true,
  buttons: false,
  carousels: false,
  polls: false,
  threads: false,
  voiceMessages: true,
  nativeCommands: false,
};

// ── Message Types ────────────────────────────────────────────
export type MessageType = "text" | "image" | "audio" | "video" | "file" | "sticker";

export interface InboundMessage {
  id: string;
  channel: ChannelId;
  type: MessageType;
  sender: {
    id: string;
    username?: string;
    displayName?: string;
    isBot?: boolean;
  };
  content: string;
  timestamp: Date;
  metadata?: {
    replyTo?: string;
    forwardFrom?: string;
    mentions?: string[];
    groupId?: string;
    groupName?: string;
    mediaUrl?: string;
    mediaMimeType?: string;
  };
}

export interface OutboundMessage {
  recipient: string;
  content: string;
  type?: MessageType;
  metadata?: {
    replyTo?: string;
    mediaUrl?: string;
    buttons?: Array<{ id: string; text: string; style?: string }>;
  };
}

// ── Adapter Interfaces ────────────────────────────────────────

export interface ChannelMessagingAdapter {
  /** Send a message to a recipient */
  send(message: OutboundMessage): Promise<string>;
  
  /** Get message by ID */
  getMessage(messageId: string): Promise<InboundMessage | null>;
  
  /** Edit an existing message */
  edit(messageId: string, newContent: string): Promise<void>;
  
  /** Delete/unsend a message */
  delete(messageId: string): Promise<void>;
}

export interface ChannelOutboundAdapter {
  /** Resolve a recipient identifier to a valid format */
  resolveRecipient(identifier: string): Promise<{
    userId?: string;
    groupId?: string;
    isValid: boolean;
  }>;
}

export interface ChannelAuthAdapter {
  /** Check if the channel is authenticated */
  isAuthenticated(): Promise<boolean>;
  
  /** Get current bot/user info */
  getMe(): Promise<{ id: string; username?: string; displayName?: string } | null>;
}

export interface ChannelSetupAdapter {
  /** Initialize channel (login, connect, etc.) */
  start(): Promise<void>;
  
  /** Stop/disconnect channel */
  stop(): Promise<void>;
  
  /** Check if channel is configured and ready */
  isReady(): boolean;
  
  /** Get configuration schema for this channel */
  getConfigSchema?(): Record<string, any>;
}

export interface ChannelGroupAdapter {
  /** Create a new group */
  createGroup(name: string, participants: string[]): Promise<string>;
  
  /** Add participant to group */
  addParticipant(groupId: string, userId: string): Promise<void>;
  
  /** Remove participant from group */
  removeParticipant(groupId: string, userId: string): Promise<void>;
  
  /** Get group info */
  getGroup(groupId: string): Promise<{
    id: string;
    name: string;
    participants: string[];
  } | null>;
  
  /** List groups the bot is in */
  listGroups(): Promise<Array<{ id: string; name: string }>>;
}

export interface ChannelDirectoryAdapter {
  /** Search for users */
  searchUsers(query: string): Promise<Array<{
    id: string;
    username?: string;
    displayName?: string;
  }>>;
  
  /** Get user by ID */
  getUser(userId: string): Promise<{
    id: string;
    username?: string;
    displayName?: string;
  } | null>;
}

export interface ChannelSecurityAdapter {
  /** Check DM policy (pairing, allowlist, open, disabled) */
  checkDmPolicy(sender: string): Promise<"pairing" | "allowlist" | "open" | "disabled">;
  
  /** Check group policy (open, disabled, allowlist) */
  checkGroupPolicy(groupId: string, sender: string): Promise<"open" | "disabled" | "allowlist">;
  
  /** Check if sender is allowed */
  isAllowed(sender: string, allowList: string[]): Promise<boolean>;
}

export interface ChannelStatusAdapter {
  /** Get channel connection status */
  getStatus(): Promise<{
    connected: boolean;
    error?: string;
    lastConnected?: Date;
  }>;
  
  /** Probe/ping the channel */
  probe?(): Promise<{ ok: boolean; latency?: number; error?: string }>;
}

export interface ChannelHeartbeatAdapter {
  /** Start heartbeat for monitoring */
  startHeartbeat?(intervalMs: number, callback: () => void): void;
  
  /** Stop heartbeat */
  stopHeartbeat?(): void;
}

export interface ChannelLogoutAdapter {
  /** Logout/disconnect the channel */
  logout(): Promise<void>;
}

export interface ChannelMentionAdapter {
  /** Parse mentions from content */
  parseMentions?(content: string): string[];
  
  /** Format mention for a user */
  formatMention?(userId: string): string;
}

export interface ChannelReactionAdapter {
  /** Add reaction to message */
  addReaction(messageId: string, emoji: string): Promise<void>;
  
  /** Remove reaction from message */
  removeReaction(messageId: string, emoji: string): Promise<void>;
  
  /** Get reactions for message */
  getReactions(messageId: string): Promise<Record<string, string[]>>;
}

export interface ChannelThreadingAdapter {
  /** Create or get thread */
  createThread?(parentMessageId: string, content: string): Promise<string>;
  
  /** Reply to thread */
  replyToThread?(threadId: string, content: string): Promise<string>;
  
  /** Get thread messages */
  getThread?(threadId: string): Promise<InboundMessage[]>;
}

export interface ChannelPollAdapter {
  /** Create a poll */
  createPoll(question: string, options: string[], options2?: {
    allowsMultipleAnswers?: boolean;
    isAnonymous?: boolean;
  }): Promise<string>;
  
  /** Vote on poll */
  vote(pollId: string, optionId: string): Promise<void>;
  
  /** Get poll results */
  getPollResults(pollId: string): Promise<{
    question: string;
    options: Array<{ id: string; text: string; votes: number }>;
    totalVotes: number;
  }>;
}

export interface ChannelStreamingAdapter {
  /** Stream messages in real-time */
  onMessage(callback: (message: InboundMessage) => void): void;
  
  /** Stream typing indicators */
  onTyping(callback: (userId: string, isTyping: boolean) => void): void;
  
  /** Stream presence updates */
  onPresence?(callback: (userId: string, status: "online" | "offline") => void): void;
}

export interface ChannelCommandAdapter {
  /** Register slash commands */
  registerCommands?(commands: Array<{
    name: string;
    description: string;
    options?: any[];
  }>): Promise<void>;
  
  /** Handle command */
  onCommand?(callback: (command: string, args: any, message: InboundMessage) => void): void;
}

export interface ChannelElevatedAdapter {
  /** Get channel's elevated runtime */
  getRuntime?(): any;
}

export interface ChannelGatewayAdapter {
  /** Get the gateway context */
  getGatewayContext?(): ChannelGatewayContext;
}

export interface ChannelGatewayContext {
  sessionKey: string;
  config: any;
  tools: ToolDefinition[];
  sendToolResult(toolName: string, result: ToolResult): Promise<void>;
}

// ── Combined Channel Plugin Interface ────────────────────────
export interface ChannelPlugin {
  readonly id: ChannelId;
  readonly name: string;
  readonly version?: string;
  
  // Required adapters
  messaging: ChannelMessagingAdapter;
  auth: ChannelAuthAdapter;
  setup: ChannelSetupAdapter;
  security: ChannelSecurityAdapter;
  
  // Optional adapters
  outbound?: ChannelOutboundAdapter;
  group?: ChannelGroupAdapter;
  directory?: ChannelDirectoryAdapter;
  status?: ChannelStatusAdapter;
  heartbeat?: ChannelHeartbeatAdapter;
  logout?: ChannelLogoutAdapter;
  mention?: ChannelMentionAdapter;
  reactions?: ChannelReactionAdapter;
  threading?: ChannelThreadingAdapter;
  poll?: ChannelPollAdapter;
  streaming?: ChannelStreamingAdapter;
  command?: ChannelCommandAdapter;
  elevated?: ChannelElevatedAdapter;
  gateway?: ChannelGatewayAdapter;
  
  // Capabilities
  getCapabilities(): ChannelCapabilities;
}
