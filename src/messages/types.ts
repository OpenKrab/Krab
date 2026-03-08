import type { BaseMessage } from "../channels/base.js";
import type {
  MessageActivationPolicy,
  MessageCommandPolicy,
  MessageQueuePolicy,
  RoutingDiagnosticsConfig,
} from "../core/types.js";

export interface MessageRuntimeConfig {
  inboundDebounceMs: number;
  activation: MessageActivationPolicy;
  commands: MessageCommandPolicy;
  queue: MessageQueuePolicy;
  routingDiagnostics: RoutingDiagnosticsConfig;
}

export interface NormalizedMessageContext {
  original: BaseMessage;
  normalizedContent: string;
  commandName?: string;
  commandArgs: string[];
  isCommand: boolean;
  isDirectMessage: boolean;
  isReply: boolean;
  hasMention: boolean;
  senderId: string;
  channelName: string;
  groupId?: string;
  threadId?: string;
  debounceKey: string;
}

export interface ActivationDecision {
  allowed: boolean;
  reason: string;
}

export interface RoutingDiagnosticEntry {
  timestamp: string;
  channelName: string;
  senderId: string;
  conversationId: string;
  reason: string;
  matchedAgentId?: string;
}
