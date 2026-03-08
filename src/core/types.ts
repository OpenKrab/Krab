// ============================================================
// 🦀 Krab — Core Types
// ============================================================
import { z } from "zod";

// ── LLM Message Types ──────────────────────────────────────
export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  name?: string;
  tool_call_id?: string;
}

// ── Agent Structured Output ────────────────────────────────
export const AgentOutputSchema = z.object({
  thinking: z
    .string()
    .describe("Internal reasoning about the current situation"),
  plan: z.array(z.string()).describe("Steps the agent plans to take"),
  tool_calls: z
    .array(
      z.object({
        name: z.string(),
        args: z.record(z.string(), z.unknown()),
      }),
    )
    .default([])
    .describe("Tools to invoke"),
  response: z
    .string()
    .describe("Final response to the user (empty if using tools)"),
  next_action: z
    .enum(["respond", "tool", "replan"])
    .describe("What to do next"),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// ── Tool Types ─────────────────────────────────────────────
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  requireApproval?: boolean; // true = ask user before executing
  sideEffect?: boolean; // true = mutating (sequential only)
  mutationCategory?: "read" | "write" | "external" | "process";
  maxOutputChars?: number;
  execute: (args: any) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
}

// ── Provider Types ─────────────────────────────────────────
export interface ProviderConfig {
  name:
    | "google"
    | "anthropic"
    | "openai"
    | "kilocode"
    | "opencode"
    | "pollinations"
    | "deepseek"
    | "ollama"
    | "openrouter"
    | string;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export interface GenerateOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

// ── Session & Memory ───────────────────────────────────────
export interface Session {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// ── MCP Configuration ────────────────────────────────────────
export interface MCPConnection {
  name: string;
  transport: 'stdio' | 'websocket';
  command?: string;
  args?: string[];
  websocketUrl?: string;
  timeout?: number;
  enabled: boolean;
  autoConnect: boolean;
}

export interface MCPServerConfig {
  enabled: boolean;
  port: number;
  websocket: boolean;
  allowedOrigins: string[];
  authentication: boolean;
}

export interface MCPConfig {
  enabled: boolean;
  client: {
    connections: MCPConnection[];
    autoDiscovery: boolean;
    timeout: number;
  };
  server: MCPServerConfig;
  tools: {
    autoRegister: boolean;
    exposedTools: string[];
    deniedTools: string[];
  };
}

// ── Config ─────────────────────────────────────────────────
export interface AgentOverride {
  id: string;
  workspace?: string;
  model?: {
    primary: string;
    fallbacks?: string[];
  };
  params?: Record<string, any>;
  tools?: {
    profile?: string;
    allow?: string[];
    deny?: string[];
    elevated?: {
      enabled: boolean;
    };
  };
  default?: boolean;
}

export interface AgentBinding {
  agentId: string;
  match: {
    channel?: string;
    accountId?: string;
    peer?: {
      kind: "direct" | "group";
      id?: string;
    };
    guildId?: string;
    roles?: string[];
    teamId?: string;
  };
  priority?: number;
}

export interface ToolProviderConfig {
  profile?: string;
  allow?: string[];
  deny?: string[];
}

export interface ReflectionOptions {
  enabled: boolean;
  threshold: number;
  maxRetries: number;
  useSeparateModel: boolean;
  reflectionPrompt?: string;
}

export interface SecretProvider {
  source: "env" | "file" | "exec";
  path?: string;
  mode?: "json" | "singleValue";
  command?: string;
  passEnv?: string[];
  allowSymlinkCommand?: boolean;
  trustedDirs?: string[];
  timeoutMs?: number;
}

export interface MessageActivationPolicy {
  mode?: "always" | "mention" | "reply" | "dm-only" | "smart";
  requireMentionInGroups?: boolean;
  allowRepliesInGroups?: boolean;
  allowThreads?: boolean;
}

export interface MessageCommandPolicy {
  enabled?: boolean;
  prefix?: string;
  allow?: string[];
  deny?: string[];
  ownerOnly?: string[];
}

export interface MessageQueuePolicy {
  mode?: "steer" | "followup" | "collect" | "interrupt";
  maxPerSession?: number;
  dropPolicy?: "oldest" | "latest" | "reject";
}

export interface RoutingDiagnosticsConfig {
  enabled?: boolean;
  includeReasons?: boolean;
  maxEntries?: number;
}

export interface KrabConfig {
  // Legacy fields for backward compatibility
  provider?: ProviderConfig;
  maxIterations?: number;
  maxRetries?: number;
  memoryLimit?: number;
  debug?: boolean;
  obsidianVaultPath?: string;
  
  // New OpenClaw-inspired structure
  agents?: {
    defaults: {
      workspace: string;
      repoRoot?: string;
      skipBootstrap?: boolean;
      bootstrapMaxChars?: number;
      bootstrapTotalMaxChars?: number;
      imageMaxDimensionPx?: number;
      userTimezone?: string;
      timeFormat?: "auto" | "12" | "24";
      model: {
        primary: string;
        fallbacks?: string[];
      };
      imageModel?: {
        primary: string;
        fallbacks?: string[];
      };
      pdfModel?: {
        primary: string;
        fallbacks?: string[];
      };
      pdfMaxBytesMb?: number;
      pdfMaxPages?: number;
      timeoutSeconds?: number;
      contextTokens?: number;
      maxConcurrent?: number;
      // Streaming configuration
      blockStreamingDefault?: "on" | "off";
      blockStreamingBreak?: "text_end" | "message_end";
      blockStreamingChunk?: {
        minChars: number;
        maxChars: number;
        breakPreference?: "paragraph" | "newline" | "sentence" | "whitespace";
      };
      blockStreamingCoalesce?: {
        minChars?: number;
        maxChars?: number;
        idleMs?: number;
      };
      humanDelay?: "off" | "natural" | { minMs: number; maxMs: number };
      // Session management
      dmScope?: "main" | "per-channel-peer" | "per-account-channel-peer";
      sessionMaintenance?: {
        mode?: "warn" | "enforce";
        pruneAfter?: string; // e.g., "30d"
        maxEntries?: number;
        rotateBytes?: string; // e.g., "10mb"
        resetArchiveRetention?: string;
        maxDiskBytes?: string;
        highWaterBytes?: string;
      };
      sessionPruning?: {
        enabled?: boolean;
        mode?: "cache-ttl";
        ttl?: string; // e.g., "5m"
        keepLastAssistants?: number;
        contextWindowEstimation?: number;
      };
      messages?: {
        inbound?: {
          debounceMs?: number;
          byChannel?: Record<string, number>;
        };
        activation?: MessageActivationPolicy;
        commands?: MessageCommandPolicy;
        groupChat?: {
          historyLimit?: number;
        };
        queue?: {
          mode?: "followup";
        } & MessageQueuePolicy;
        routingDiagnostics?: RoutingDiagnosticsConfig;
      };
    };
    list?: AgentOverride[];
    bindings?: AgentBinding[];
  };
  reflector?: ReflectionOptions;
  gateway?: {
    mode: "local" | "remote";
    port: number;
    bind: "loopback" | "lan" | "tailnet" | "custom";
    auth: {
      mode: "none" | "token" | "password" | "trusted-proxy";
      token?: string;
      password?: string;
      trustedProxy?: {
        userHeader: string;
      };
      allowTailscale?: boolean;
      rateLimit?: {
        maxAttempts: number;
        windowMs: number;
        lockoutMs: number;
        exemptLoopback: boolean;
      };
    };
    controlUi?: {
      enabled: boolean;
      basePath: string;
    };
    http?: {
      endpoints?: {
        chatCompletions?: {
          enabled: boolean;
        };
        responses?: {
          enabled: boolean;
          maxUrlParts?: number;
          files?: {
            urlAllowlist?: string[];
          };
          images?: {
            urlAllowlist?: string[];
          };
        };
      };
      securityHeaders?: {
        strictTransportSecurity?: string;
      };
    };
  };
  tools?: {
    profile: "minimal" | "coding" | "messaging" | "full";
    allow?: string[];
    deny?: string[];
    byProvider?: Record<string, ToolProviderConfig>;
    elevated?: {
      enabled: boolean;
      allowFrom?: Record<string, string[]>;
    };
    exec?: {
      backgroundMs: number;
      timeoutSec: number;
      cleanupMs: number;
      notifyOnExit: boolean;
      notifyOnExitEmptySuccess: boolean;
      applyPatch?: {
        enabled: boolean;
        allowModels: string[];
      };
    };
  };
  secrets?: {
    providers: Record<string, SecretProvider>;
    defaults: {
      env: string;
      file: string;
      exec: string;
    };
  };
  mcp?: MCPConfig;
}
