// ============================================================
// 🦀 Krab — Configuration System (OpenClaw-inspired)
// ============================================================
import { ReflectionOptions } from "./reflector.js";
import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { config as dotenvConfig } from "dotenv";

export interface KrabConfig {
  agents: {
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
    };
    list?: Record<string, AgentOverride>;
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
  tools: {
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
}

export interface AgentOverride {
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
}

export interface ToolProviderConfig {
  profile?: string;
  allow?: string[];
  deny?: string[];
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

const DEFAULT_CONFIG: KrabConfig = {
  agents: {
    defaults: {
      workspace: "~/.krab/workspace",
      bootstrapMaxChars: 20000,
      bootstrapTotalMaxChars: 150000,
      imageMaxDimensionPx: 1200,
      userTimezone: "Asia/Bangkok",
      timeFormat: "auto",
      model: {
        primary: "google/gemini-2.0-flash",
        fallbacks: ["openrouter/free"],
      },
      imageModel: {
        primary: "openrouter/qwen/qwen-2.5-vl-72b-instruct:free",
        fallbacks: ["openrouter/google/gemini-2.0-flash-vision:free"],
      },
      pdfModel: {
        primary: "google/gemini-2.0-flash",
        fallbacks: ["openrouter/free"],
      },
      pdfMaxBytesMb: 10,
      pdfMaxPages: 20,
      timeoutSeconds: 600,
      contextTokens: 200000,
      maxConcurrent: 1,
    },
  },
  reflector: {
    enabled: true,
    threshold: 75,
    maxRetries: 2,
    useSeparateModel: false,
  },
  gateway: {
    mode: "local",
    port: 18789,
    bind: "loopback",
    auth: {
      mode: "none", // For local development
      allowTailscale: true,
      rateLimit: {
        maxAttempts: 10,
        windowMs: 60000,
        lockoutMs: 300000,
        exemptLoopback: true,
      },
    },
    controlUi: {
      enabled: true,
      basePath: "/krab",
    },
    http: {
      endpoints: {
        chatCompletions: {
          enabled: true,
        },
        responses: {
          enabled: true,
        },
      },
    },
  },
  tools: {
    profile: "messaging",
    allow: ["*"],
    deny: ["browser"],
    elevated: {
      enabled: false,
      allowFrom: {
        cli: ["*"],
      },
    },
    exec: {
      backgroundMs: 10000,
      timeoutSec: 1800,
      cleanupMs: 1800000,
      notifyOnExit: true,
      notifyOnExitEmptySuccess: false,
      applyPatch: {
        enabled: false,
        allowModels: ["*"],
      },
    },
  },
  secrets: {
    providers: {
      default: {
        source: "env",
      },
      filemain: {
        source: "file",
        path: "~/.krab/secrets.json",
        mode: "json",
        timeoutMs: 5000,
      },
    },
    defaults: {
      env: "default",
      file: "filemain",
      exec: "vault",
    },
  },
};

const CONFIG_PATH = resolve(process.cwd(), "krab.json");
const ENV_PATH = resolve(process.cwd(), ".env");

export function loadConfig(): KrabConfig {
  // Load environment variables first
  dotenvConfig({ path: ENV_PATH });

  // Load config file if exists
  if (existsSync(CONFIG_PATH)) {
    try {
      const configData = readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(configData) as KrabConfig;

      // Merge with defaults
      return mergeConfig(DEFAULT_CONFIG, config);
    } catch (error) {
      console.error(`Failed to load config from ${CONFIG_PATH}:`, error);
      return DEFAULT_CONFIG;
    }
  }

  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<KrabConfig>): void {
  const currentConfig = loadConfig();
  const mergedConfig = mergeConfig(currentConfig, config);

  writeFileSync(CONFIG_PATH, JSON.stringify(mergedConfig, null, 2));
  console.log(`Config saved to ${CONFIG_PATH}`);
}

export function mergeConfig(
  base: KrabConfig,
  override: Partial<KrabConfig>,
): KrabConfig {
  const merged = JSON.parse(JSON.stringify(base)); // Deep clone

  function merge(target: any, source: any) {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        merge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  merge(merged, override);
  return merged;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getEnvPath(): string {
  return ENV_PATH;
}
