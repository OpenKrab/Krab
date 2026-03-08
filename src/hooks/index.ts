// ============================================================
// 🦀 Krab — Hooks System
// ============================================================
import { z } from "zod";
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

// Hook metadata schema
export const HookMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  homepage: z.string().optional(),
  metadata: z.object({
    openclaw: z.object({
      emoji: z.string().optional(),
      events: z.array(z.string()),
      export: z.string().default("default"),
      requires: z.object({
        bins: z.array(z.string()).optional(),
        anyBins: z.array(z.string()).optional(),
        env: z.array(z.string()).optional(),
        config: z.array(z.string()).optional(),
        os: z.array(z.string()).optional(),
        always: z.boolean().optional()
      }).optional()
    })
  })
});

export type HookMetadata = z.infer<typeof HookMetadataSchema>;

// Hook handler interface
export interface HookHandler {
  execute: (event: HookEvent) => Promise<void>;
}

// Hook event interface
export interface HookEvent {
  type: string;
  data: any;
  timestamp: Date;
  sessionId?: string;
}

// Hook definition
export interface HookDefinition {
  metadata: HookMetadata;
  handler: HookHandler;
  path: string;
  enabled: boolean;
}

// Hooks manager class
export class HooksManager {
  private hooks = new Map<string, HookDefinition>();
  private hookDirs = [
    path.join(process.cwd(), "hooks"), // workspace hooks
    path.join(os.homedir(), ".krab", "hooks"), // managed hooks
    path.join(moduleDir, "bundled") // bundled hooks
  ];

  constructor() {
    this.discoverHooks();
  }

  private discoverHooks(): void {
    for (const dir of this.hookDirs) {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const hookPath = path.join(dir, item);
          if (fs.statSync(hookPath).isDirectory()) {
            this.loadHook(hookPath);
          }
        }
      }
    }
  }

  private loadHook(hookPath: string): void {
    const hookMdPath = path.join(hookPath, "HOOK.md");
    const handlerPath = path.join(hookPath, "handler.ts");

    if (!fs.existsSync(hookMdPath) || !fs.existsSync(handlerPath)) {
      return;
    }

    try {
      // Parse HOOK.md
      const content = fs.readFileSync(hookMdPath, "utf8");
      const metadata = this.parseHookMetadata(content);

      // Load handler
      const handlerModule = require(handlerPath);
      const handler: HookHandler = handlerModule[metadata.metadata.openclaw.export || "default"];

      const hook: HookDefinition = {
        metadata,
        handler,
        path: hookPath,
        enabled: this.isHookEligible(metadata)
      };

      this.hooks.set(metadata.name, hook);
      logger.info(`[Hooks] Loaded hook: ${metadata.name}`);

    } catch (error) {
      logger.error(`[Hooks] Failed to load hook at ${hookPath}:`, error);
    }
  }

  private parseHookMetadata(content: string): HookMetadata {
    // Simple frontmatter parser (YAML)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error("Invalid HOOK.md format: missing frontmatter");
    }

    const yamlContent = frontmatterMatch[1];
    // Basic YAML parsing (in production, use a proper YAML parser)
    const metadata: any = {};
    const lines = yamlContent.split("\n");

    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(":").trim();
        this.setNestedProperty(metadata, key.trim(), value);
      }
    }

    return HookMetadataSchema.parse(metadata);
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  private isHookEligible(metadata: HookMetadata): boolean {
    const requires = metadata.metadata.openclaw.requires;
    if (!requires) return true;

    // Check binaries
    if (requires.bins) {
      for (const bin of requires.bins) {
        try {
          require("child_process").execSync(`which ${bin}`, { stdio: "ignore" });
        } catch {
          return false;
        }
      }
    }

    // Check environment variables
    if (requires.env) {
      for (const env of requires.env) {
        if (!process.env[env]) return false;
      }
    }

    // Check OS
    if (requires.os) {
      const currentOs = process.platform;
      if (!requires.os.includes(currentOs)) return false;
    }

    return true;
  }

  async fireEvent(event: HookEvent): Promise<void> {
    const matchingHooks = Array.from(this.hooks.values()).filter(
      hook => hook.enabled && hook.metadata.metadata.openclaw.events.includes(event.type)
    );

    for (const hook of matchingHooks) {
      try {
        await hook.handler.execute(event);
        logger.info(`[Hooks] Executed hook ${hook.metadata.name} for event ${event.type}`);
      } catch (error) {
        logger.error(`[Hooks] Hook ${hook.metadata.name} failed:`, error);
      }
    }
  }

  getHooks(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }

  enableHook(name: string): boolean {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = true;
      return true;
    }
    return false;
  }

  disableHook(name: string): boolean {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = false;
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const hooksManager = new HooksManager();
