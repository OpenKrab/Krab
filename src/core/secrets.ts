// ============================================================
// 🦀 Krab — Secrets Management (OpenClaw-inspired)
// ============================================================
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { execSync } from "child_process";
import { logger } from "../utils/logger.js";

export interface SecretRef {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
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

export interface SecretsConfig {
  providers: Record<string, SecretProvider>;
  defaults: {
    env: string;
    file: string;
    exec: string;
  };
}

export interface SecretsAuditEntry {
  key: string;
  resolved: boolean;
  source: SecretRef["source"];
  provider: string;
  error?: string;
}

export function resolveSecretsStateRoot(): string {
  const envRoot = process.env.KRAB_STATE_DIR || process.env.KRAB_DATA_DIR;
  if (envRoot && envRoot.trim().length > 0) {
    return resolve(envRoot);
  }
  return process.cwd();
}

export function getSecretsEnvPath(stateRoot = resolveSecretsStateRoot()): string {
  return join(stateRoot, ".env");
}

export function readSecretsEnvFile(envPath = getSecretsEnvPath()): Record<string, string> {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }
  return env;
}

export function writeSecretsEnvFile(
  env: Record<string, string>,
  envPath = getSecretsEnvPath(),
): void {
  const parentDir = dirname(envPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  writeFileSync(envPath, lines.join("\n") + "\n");
}

export class SecretsManager {
  private config: SecretsConfig;
  private cache: Map<string, any> = new Map();
  private workspace: string;

  constructor(workspace: string, config: SecretsConfig) {
    this.workspace = resolve(workspace);
    this.config = config;
    this.ensureWorkspace();
  }

  async tryResolveSecret(secretRef: SecretRef): Promise<{ ok: true; value: any } | { ok: false; error: string }> {
    try {
      const value = await this.resolveSecret(secretRef);
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private ensureWorkspace(): void {
    if (!existsSync(this.workspace)) {
      mkdirSync(this.workspace, { recursive: true });
    }
  }

  async resolveSecret(secretRef: SecretRef): Promise<any> {
    const cacheKey = `${secretRef.provider}:${secretRef.id}`;
    
    if (this.cache.has(cacheKey)) {
      logger.debug(`[Secrets] Cache hit for ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    const provider = this.config.providers[secretRef.provider];
    if (!provider) {
      throw new Error(`Secret provider '${secretRef.provider}' not found`);
    }

    let value: any;

    try {
      switch (provider.source) {
        case "env":
          value = this.resolveFromEnv(secretRef, provider);
          break;
        case "file":
          value = await this.resolveFromFile(secretRef, provider);
          break;
        case "exec":
          value = await this.resolveFromExec(secretRef, provider);
          break;
        default:
          throw new Error(`Unsupported secret source: ${provider.source}`);
      }

      this.cache.set(cacheKey, value);
      logger.debug(`[Secrets] Resolved ${cacheKey}`);
      return value;

    } catch (error) {
      logger.error(`[Secrets] Failed to resolve ${cacheKey}:`, error);
      throw error;
    }
  }

  private resolveFromEnv(secretRef: SecretRef, provider: SecretProvider): any {
    const envVar = secretRef.id;
    const value = process.env[envVar];
    
    if (value === undefined) {
      throw new Error(`Environment variable ${envVar} not found`);
    }

    return value;
  }

  private async resolveFromFile(secretRef: SecretRef, provider: SecretProvider): Promise<any> {
    const filePath = resolve(provider.path || "~/.krab/secrets.json");
    
    if (!existsSync(filePath)) {
      throw new Error(`Secrets file not found: ${filePath}`);
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      
      if (provider.mode === "singleValue") {
        if (secretRef.id !== "value") {
          throw new Error(`For singleValue mode, id must be 'value', got '${secretRef.id}'`);
        }
        return content.trim();
      } else {
        // JSON mode
        const secrets = JSON.parse(content);
        const jsonPointer = secretRef.id.replace(/^\//, "").split("/");
        let value = secrets;
        
        for (const part of jsonPointer) {
          if (value && typeof value === "object" && part in value) {
            value = value[part];
          } else {
            throw new Error(`Secret path '${secretRef.id}' not found in ${filePath}`);
          }
        }
        
        return value;
      }
    } catch (error) {
      throw new Error(`Failed to read secrets from ${filePath}: ${error}`);
    }
  }

  private async resolveFromExec(secretRef: SecretRef, provider: SecretProvider): Promise<any> {
    if (!provider.command) {
      throw new Error(`Exec provider requires command`);
    }

    const command = resolve(provider.command);
    
    // Validate command path
    if (!provider.allowSymlinkCommand && existsSync(command)) {
      const stats = require("fs").lstatSync(command);
      if (stats.isSymbolicLink()) {
        throw new Error(`Symlink commands not allowed: ${command}`);
      }
    }

    // Check trusted dirs if configured
    if (provider.trustedDirs) {
      const commandDir = resolve(command, "..");
      const isTrusted = provider.trustedDirs.some(dir => {
        const resolvedDir = resolve(dir);
        return commandDir.startsWith(resolvedDir);
      });
      
      if (!isTrusted) {
        throw new Error(`Command not in trusted directory: ${command}`);
      }
    }

    try {
      const env: Record<string, string> = {};
      
      // Pass specific environment variables
      if (provider.passEnv) {
        for (const key of provider.passEnv) {
          const value = process.env[key];
          if (value !== undefined) {
            env[key] = value;
          }
        }
      }

      // Prepare protocol payload
      const payload = {
        action: "get",
        id: secretRef.id,
        provider: secretRef.provider
      };

      const options: any = {
        env: { ...process.env, ...env },
        timeout: provider.timeoutMs || 5000,
        encoding: "utf-8"
      };

      const result = execSync(command, {
        input: JSON.stringify(payload),
        ...options
      });

      const response = JSON.parse(result.toString());
      
      if (response.error) {
        throw new Error(response.error);
      }

      return response.value;

    } catch (error) {
      throw new Error(`Exec command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async resolveSecretsBatch(secretRefs: SecretRef[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    await Promise.all(
      secretRefs.map(async (ref) => {
        const key = `${ref.provider}:${ref.id}`;
        try {
          results[key] = await this.resolveSecret(ref);
        } catch (error) {
          results[key] = { error: error instanceof Error ? error.message : String(error) };
        }
      })
    );

    return results;
  }

  clearCache(): void {
    this.cache.clear();
    logger.info("[Secrets] Cache cleared");
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  validateSecretRef(secretRef: SecretRef): boolean {
    // Validate provider pattern
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(secretRef.provider)) {
      return false;
    }

    // Validate id pattern based on source
    const provider = this.config.providers[secretRef.provider];
    if (!provider) return false;

    switch (provider.source) {
      case "env":
        return /^[A-Z][A-Z0-9_]{0,127}$/.test(secretRef.id);
      case "file":
        return secretRef.id.startsWith("/") && secretRef.id.length > 1;
      case "exec":
        return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(secretRef.id);
      default:
        return false;
    }
  }

  // Helper methods for common secret patterns
  static createEnvRef(provider: string, envVar: string): SecretRef {
    return {
      source: "env",
      provider,
      id: envVar
    };
  }

  static createFileRef(provider: string, jsonPointer: string): SecretRef {
    return {
      source: "file",
      provider,
      id: jsonPointer
    };
  }

  static createExecRef(provider: string, id: string): SecretRef {
    return {
      source: "exec",
      provider,
      id
    };
  }

  // Apply secrets to configuration
  async applySecrets(config: any, secretPaths: Record<string, SecretRef>): Promise<any> {
    const resolved = await this.resolveSecretsBatch(Object.values(secretPaths));
    
    function applySecrets(obj: any, path: string[], value: any): void {
      if (path.length === 0) {
        if (typeof obj === "object" && value !== null) {
          Object.assign(obj, value);
        } else {
          return;
        }
        return;
      }

      const [key, ...rest] = path;
      
      if (!(key in obj) || typeof obj[key] !== "object") {
        obj[key] = {};
      }
      
      applySecrets(obj[key], rest, value);
    }

    const result = JSON.parse(JSON.stringify(config)); // Deep clone
    
    for (const [configPath, secretRef] of Object.entries(secretPaths)) {
      const secretKey = `${secretRef.provider}:${secretRef.id}`;
      const value = resolved[secretKey];
      
      if (value && !value.error) {
        const path = configPath.split(".");
        applySecrets(result, path, value);
      } else {
        logger.warn(`[Secrets] Failed to apply ${configPath}: ${value?.error}`);
      }
    }

    return result;
  }
}

 export function createDefaultSecretsConfig(stateRoot: string): SecretsConfig {
   return {
     providers: {
       default: {
         source: "env",
       },
       filemain: {
         source: "file",
         path: resolve(stateRoot, "secrets.json"),
         mode: "json",
         timeoutMs: 5000,
       },
     },
     defaults: {
       env: "default",
       file: "filemain",
       exec: "default",
     },
   };
 }

 export function createSecretsManager(stateRoot: string, config?: Partial<SecretsConfig>): SecretsManager {
   const defaults = createDefaultSecretsConfig(stateRoot);
   const merged: SecretsConfig = {
     providers: {
       ...defaults.providers,
       ...(config?.providers || {}),
     },
     defaults: {
       ...defaults.defaults,
       ...(config?.defaults || {}),
     },
   };
   return new SecretsManager(stateRoot, merged);
 }

 export function createRuntimeSecretsManager(config?: Partial<SecretsConfig>): SecretsManager {
   return createSecretsManager(resolveSecretsStateRoot(), config);
 }
