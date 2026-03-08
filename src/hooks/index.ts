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
import yaml from "js-yaml";
import { sessionMemoryHandler } from "./bundled/session-memory.js";

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
    this.registerBuiltInHooks();
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
      const exportName = metadata.metadata.openclaw.export || "default";
      const handlerModule = require(handlerPath) as Record<string, unknown>;
      const handler = handlerModule[exportName] as HookHandler | undefined;
      if (!handler || typeof handler.execute !== "function") {
        throw new Error(`Hook export '${exportName}' is missing or invalid`);
      }

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
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error("Invalid HOOK.md format: missing frontmatter");
    }

    const yamlContent = frontmatterMatch[1];
    const parsed = yaml.load(yamlContent);
    return HookMetadataSchema.parse(parsed);
  }

  private registerBuiltInHooks(): void {
    const builtIns = [
      {
        hookDir: path.join(moduleDir, "bundled", "session-memory"),
        metadataFile: path.join(moduleDir, "bundled", "session-memory", "HOOK.md"),
        handler: sessionMemoryHandler,
      },
    ];

    for (const builtIn of builtIns) {
      if (this.hooks.has("session-memory")) {
        continue;
      }
      if (!fs.existsSync(builtIn.metadataFile)) {
        continue;
      }
      try {
        const metadata = this.parseHookMetadata(fs.readFileSync(builtIn.metadataFile, "utf8"));
        this.hooks.set(metadata.name, {
          metadata,
          handler: builtIn.handler,
          path: builtIn.hookDir,
          enabled: this.isHookEligible(metadata),
        });
      } catch (error) {
        logger.error(`[Hooks] Failed to register built-in hook at ${builtIn.hookDir}:`, error);
      }
    }
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
