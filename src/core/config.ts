// ============================================================
// 🦀 Krab — Configuration Loader (Clean & Stable)
// ============================================================
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { KrabConfig, ProviderConfig } from "./types.js";
import { createRuntimeSecretsManager, getSecretsEnvPath } from "./secrets.js";

// Load .env
const envPaths = [
  getSecretsEnvPath(),
  resolve(process.env.HOME || process.env.USERPROFILE || "", ".krab", ".env"),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenvConfig({ path: envPath });
    break;
  }
}

// ── Provider Metadata (OpenClaw style) ──────────────────────────
const PROVIDER_METADATA: Record<
  string,
  { env: string[]; defaultModel: string; baseURL?: string }
> = {
  google: {
    env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    defaultModel: "gemini-2.0-flash",
  },
  anthropic: {
    env: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-3-5-sonnet-latest",
  },
  openai: {
    env: ["OPENAI_API_KEY"],
    defaultModel: "gpt-4o-mini",
  },
  kilocode: {
    env: ["KILOCODE_API_KEY"],
    defaultModel: "stepfun/step-3.5-flash",
    baseURL: "https://api.kilo.ai/api/gateway",
  },
  opencode: {
    env: ["OPENCODE_API_KEY"],
    defaultModel: "big-pickle",
    baseURL: "https://opencode.ai/zen/v1",
  },
  openrouter: {
    env: ["OPENROUTER_API_KEY"],
    defaultModel: "openrouter/free",
    baseURL: "https://openrouter.ai/api/v1",
  },
  deepseek: {
    env: ["DEEPSEEK_API_KEY"],
    defaultModel: "deepseek-chat",
    baseURL: "https://api.deepseek.com",
  },
  ollama: {
    env: ["OLLAMA_API_KEY"], // optional for local
    defaultModel: "llama3",
    baseURL: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
  },
};

function resolveFirstSecret(envKeys: string[]): string | undefined {
  const manager = createRuntimeSecretsManager();
  for (const envKey of envKeys) {
    const direct = process.env[envKey];
    if (direct) {
      return direct;
    }

    try {
      const provider = (manager as any).config?.defaults?.env || "default";
      const secretProvider = (manager as any).config?.providers?.[provider];
      if (secretProvider?.source === "env") {
        const value = process.env[envKey];
        if (value) {
          return value;
        }
      }
    } catch {
      // best effort only
    }
  }
  return undefined;
}

function detectProvider(): ProviderConfig {
  const defaultModelEnv = process.env.KRAB_DEFAULT_MODEL || "";

  // 1. Explicit routing by prefix (e.g., "kilocode/...")
  for (const [name, meta] of Object.entries(PROVIDER_METADATA)) {
    if (defaultModelEnv.startsWith(`${name}/`)) {
      const apiKey = resolveFirstSecret(meta.env);
      if (apiKey) {
        return {
          name: name as any,
          model: defaultModelEnv.replace(`${name}/`, ""),
          apiKey,
          baseURL: meta.baseURL,
        };
      }
    }
  }

  // 2. Short-hand prefixes for popular ones
  if (defaultModelEnv.startsWith("gemini/")) {
    const apiKey = resolveFirstSecret(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
    if (apiKey) {
      return {
        name: "google",
        model: defaultModelEnv.replace("gemini/", ""),
        apiKey,
      };
    }
  }
  if (defaultModelEnv.startsWith("claude/")) {
    const apiKey = resolveFirstSecret(["ANTHROPIC_API_KEY"]);
    if (apiKey) {
      return {
        name: "anthropic",
        model: defaultModelEnv.replace("claude/", ""),
        apiKey,
      };
    }
  }

  // Auto-detection by ENV existence
  for (const [name, meta] of Object.entries(PROVIDER_METADATA)) {
    const apiKey = resolveFirstSecret(meta.env);
    if (!apiKey) continue;

    // If the user specified KRAB_DEFAULT_MODEL but it didn't have a prefix
    let model = meta.defaultModel;
    if (defaultModelEnv && !defaultModelEnv.includes("/")) {
      model = defaultModelEnv;
    }

    return {
      name: name as any,
      model,
      apiKey,
      baseURL: meta.baseURL,
    };
  }

  throw new Error(
    "No valid LLM provider found. Please set GEMINI_API_KEY or KILOCODE_API_KEY etc. in .env",
  );
}

export function loadConfig(): KrabConfig {
  const provider = detectProvider();

  return {
    agents: {
      defaults: {
        workspace: process.cwd(),
        repoRoot: process.cwd(),
        model: {
          primary: provider.model,
          fallbacks: [],
        },
        timeoutSeconds: 30,
        contextTokens: 4096,
        maxConcurrent: 3,
      },
    },
    provider,
    maxIterations: parseInt(process.env.KRAB_MAX_ITERATIONS || "10", 10),
    maxRetries: parseInt(process.env.KRAB_MAX_RETRIES || "3", 10),
    memoryLimit: parseInt(process.env.KRAB_MEMORY_LIMIT || "50", 10),
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH,
    debug: process.env.KRAB_DEBUG === "true",
  };
}

export function saveConfig(config: KrabConfig): void {
  // Save config to .env file (simplified - real implementation would save JSON)
  const envPath = getSecretsEnvPath();
  const lines: string[] = [];

  if (config.provider?.name) {
    lines.push(`KRAB_PROVIDER=${config.provider.name}`);
  }
  if (config.provider?.model) {
    lines.push(`KRAB_MODEL=${config.provider.model}`);
  }
  if (config.provider?.apiKey) {
    lines.push(`KRAB_API_KEY=${config.provider.apiKey}`);
  }
  
  import("node:fs").then(fs => {
    fs.writeFileSync(envPath, lines.join("\n") + "\n");
  });
}
