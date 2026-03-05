// ============================================================
// 🦀 Krab — Plugin Loader
// Discovers, validates, and loads plugins from disk
// ============================================================
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { registry } from "../tools/registry.js";
import { logger } from "../utils/logger.js";
import {
  PluginManifestSchema,
  type PluginManifest,
  type LoadedPlugin,
  type MiddlewareEntry,
  type MiddlewareFn,
  type PluginRegistryFile,
  type PluginRegistryEntry,
  type Channel,
} from "./types.js";
import type { ToolDefinition } from "../core/types.js";

// ── Constants ───────────────────────────────────────────────
const MANIFEST_FILENAME = "krab-plugin.json";
const REGISTRY_FILENAME = "registry.json";

function getGlobalPluginsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return resolve(home, ".krab", "plugins");
}

function getLocalPluginsDir(): string {
  return resolve(process.cwd(), "krab-plugins");
}

// ════════════════════════════════════════════════════════════
// 🔄 PluginLoader — Main class
// ════════════════════════════════════════════════════════════
export class PluginLoader {
  private plugins = new Map<string, LoadedPlugin>();
  private middlewareEntries: MiddlewareEntry[] = [];
  private channels = new Map<string, Channel>();
  private registryFile: PluginRegistryFile = { version: 1, installed: {} };
  private globalDir: string;
  private localDir: string;

  constructor() {
    this.globalDir = getGlobalPluginsDir();
    this.localDir = getLocalPluginsDir();
  }

  // ── Discover plugins from standard directories ─────────────
  async discover(): Promise<{ path: string; manifest: PluginManifest }[]> {
    const discovered: { path: string; manifest: PluginManifest }[] = [];

    const dirs = [this.globalDir, this.localDir];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;

      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith(".")) continue;

          const pluginDir = join(dir, entry.name);
          const manifestPath = join(pluginDir, MANIFEST_FILENAME);

          if (!existsSync(manifestPath)) continue;

          try {
            const raw = await readFile(manifestPath, "utf-8");
            const json = JSON.parse(raw);
            const parsed = PluginManifestSchema.safeParse(json);

            if (parsed.success) {
              discovered.push({ path: pluginDir, manifest: parsed.data });
            } else {
              logger.warn(
                `[PluginLoader] Invalid manifest in ${pluginDir}: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
              );
            }
          } catch (err: any) {
            logger.warn(
              `[PluginLoader] Failed to read manifest in ${pluginDir}: ${err.message}`,
            );
          }
        }
      } catch {
        // Directory doesn't exist or isn't readable
      }
    }

    return discovered;
  }

  // ── Load a single plugin by directory path ──────────────────
  async load(pluginDir: string): Promise<LoadedPlugin> {
    const manifestPath = join(pluginDir, MANIFEST_FILENAME);

    // 1. Read and validate manifest
    const raw = await readFile(manifestPath, "utf-8");
    const json = JSON.parse(raw);
    const parsed = PluginManifestSchema.parse(json);

    // 2. Check if already loaded
    if (this.plugins.has(parsed.name)) {
      const existing = this.plugins.get(parsed.name)!;
      if (existing.status === "loaded") {
        logger.debug(
          `[PluginLoader] Plugin "${parsed.name}" already loaded, skipping`,
        );
        return existing;
      }
    }

    // 3. Check if disabled in registry
    const regEntry = this.registryFile.installed[parsed.name];
    if (regEntry && !regEntry.enabled) {
      const plugin: LoadedPlugin = {
        manifest: parsed,
        path: pluginDir,
        module: null,
        status: "disabled",
        loadedAt: new Date(),
        registeredTools: [],
        registeredChannels: [],
        registeredAgents: [],
      };
      this.plugins.set(parsed.name, plugin);
      logger.debug(`[PluginLoader] Plugin "${parsed.name}" is disabled`);
      return plugin;
    }

    // 4. Dynamic import the entry module
    const entryPath = resolve(pluginDir, parsed.krab.entry);
    let mod: Record<string, any>;

    try {
      // Convert to file URL for Windows compatibility
      const entryUrl = pathToFileURL(entryPath).href;
      mod = await import(entryUrl);
    } catch (err: any) {
      const plugin: LoadedPlugin = {
        manifest: parsed,
        path: pluginDir,
        module: null,
        status: "error",
        error: `Failed to import: ${err.message}`,
        loadedAt: new Date(),
        registeredTools: [],
        registeredChannels: [],
        registeredAgents: [],
      };
      this.plugins.set(parsed.name, plugin);
      logger.error(
        `[PluginLoader] Failed to load "${parsed.name}": ${err.message}`,
      );
      return plugin;
    }

    // 5. Build plugin instance
    const plugin: LoadedPlugin = {
      manifest: parsed,
      path: pluginDir,
      module: mod,
      status: "loaded",
      loadedAt: new Date(),
      registeredTools: [],
      registeredChannels: [],
      registeredAgents: [],
    };

    // 6. Register tools
    if (parsed.tools && parsed.tools.length > 0) {
      for (const toolEntry of parsed.tools) {
        try {
          const toolDef = mod[toolEntry.export] as ToolDefinition;
          if (!toolDef || typeof toolDef.execute !== "function") {
            logger.warn(
              `[PluginLoader] Tool "${toolEntry.name}" from "${parsed.name}" — export "${toolEntry.export}" is not a valid ToolDefinition`,
            );
            continue;
          }

          // Validate that the exported name matches
          let finalTool = toolDef;
          if (toolDef.name !== toolEntry.name) {
            logger.warn(
              `[PluginLoader] Tool name mismatch: manifest says "${toolEntry.name}" but export has name "${toolDef.name}". Using manifest name.`,
            );
            // Create a new tool def with the manifest name
            finalTool = { ...toolDef, name: toolEntry.name };
          }

          registry.register(finalTool);
          plugin.registeredTools.push(toolEntry.name);
          logger.info(
            `[PluginLoader] ✅ Registered tool "${toolEntry.name}" from plugin "${parsed.name}"`,
          );
        } catch (err: any) {
          logger.error(
            `[PluginLoader] Failed to register tool "${toolEntry.name}": ${err.message}`,
          );
        }
      }
    }

    // 7. Register middleware
    if (parsed.middleware && parsed.middleware.length > 0) {
      for (const mwEntry of parsed.middleware) {
        try {
          const mwFn: MiddlewareFn = mod[mwEntry.export];
          if (typeof mwFn !== "function") {
            logger.warn(
              `[PluginLoader] Middleware "${mwEntry.export}" from "${parsed.name}" is not a function`,
            );
            continue;
          }

          this.middlewareEntries.push({
            hook: mwEntry.hook,
            fn: mwFn,
            priority: mwEntry.priority,
            pluginName: parsed.name,
          });

          logger.info(
            `[PluginLoader] ✅ Registered middleware "${mwEntry.hook}" from plugin "${parsed.name}"`,
          );
        } catch (err: any) {
          logger.error(
            `[PluginLoader] Failed to register middleware: ${err.message}`,
          );
        }
      }
    }

    // 8. Register channels
    if (parsed.channels && parsed.channels.length > 0) {
      for (const chanEntry of parsed.channels) {
        try {
          const channel = mod[chanEntry.export] as Channel;
          if (!channel || typeof channel.start !== "function") {
            logger.warn(
              `[PluginLoader] Channel "${chanEntry.name}" from "${parsed.name}" — export "${chanEntry.export}" is not a valid Channel`,
            );
            continue;
          }

          this.channels.set(chanEntry.name, channel);
          plugin.registeredChannels.push(chanEntry.name);
          logger.info(
            `[PluginLoader] ✅ Registered channel "${chanEntry.name}" from plugin "${parsed.name}"`,
          );
        } catch (err: any) {
          logger.error(
            `[PluginLoader] Failed to register channel "${chanEntry.name}": ${err.message}`,
          );
        }
      }
    }

    // 9. Call onStart lifecycle hook if plugin exports one
    if (typeof mod.onStart === "function") {
      try {
        await mod.onStart();
        logger.debug(`[PluginLoader] Called onStart for "${parsed.name}"`);
      } catch (err: any) {
        logger.warn(
          `[PluginLoader] onStart failed for "${parsed.name}": ${err.message}`,
        );
      }
    }

    this.plugins.set(parsed.name, plugin);
    return plugin;
  }

  // ── Load all discovered plugins ─────────────────────────────
  async loadAll(): Promise<LoadedPlugin[]> {
    // Ensure global plugins directory exists
    try {
      await mkdir(this.globalDir, { recursive: true });
    } catch {
      // OK if it already exists
    }

    // Load registry file
    await this.loadRegistryFile();

    // Discover and load
    const discovered = await this.discover();
    const loaded: LoadedPlugin[] = [];

    for (const { path: pluginDir } of discovered) {
      try {
        const plugin = await this.load(pluginDir);
        loaded.push(plugin);
      } catch (err: any) {
        logger.error(
          `[PluginLoader] Failed to load plugin from ${pluginDir}: ${err.message}`,
        );
      }
    }

    if (loaded.length > 0) {
      const successCount = loaded.filter((p) => p.status === "loaded").length;
      const errorCount = loaded.filter((p) => p.status === "error").length;
      const disabledCount = loaded.filter(
        (p) => p.status === "disabled",
      ).length;

      logger.info(
        `[PluginLoader] Loaded ${successCount} plugin(s)` +
          (errorCount > 0 ? `, ${errorCount} error(s)` : "") +
          (disabledCount > 0 ? `, ${disabledCount} disabled` : ""),
      );
    }

    // Sort middleware by priority
    this.middlewareEntries.sort((a, b) => a.priority - b.priority);

    return loaded;
  }

  // ── Unload a plugin ──────────────────────────────────────────
  async unload(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    // Call onShutdown if available
    if (plugin.module && typeof plugin.module.onShutdown === "function") {
      try {
        await plugin.module.onShutdown();
      } catch (err: any) {
        logger.warn(
          `[PluginLoader] onShutdown failed for "${name}": ${err.message}`,
        );
      }
    }

    // Remove registered tools from registry
    // Note: ToolRegistry doesn't have unregister, but we track what was registered
    // In a future version, we'd add registry.unregister()

    // Remove middleware
    this.middlewareEntries = this.middlewareEntries.filter(
      (m) => m.pluginName !== name,
    );

    this.plugins.delete(name);
    logger.info(`[PluginLoader] Unloaded plugin "${name}"`);
    return true;
  }

  // ── Get middleware chain for a hook ──────────────────────────
  getMiddleware(hook: string): MiddlewareEntry[] {
    return this.middlewareEntries.filter((m) => m.hook === hook);
  }

  // ── Run middleware chain ─────────────────────────────────────
  async runMiddleware(hook: string, ctx: Record<string, any>): Promise<void> {
    const entries = this.getMiddleware(hook);
    if (entries.length === 0) return;

    let index = 0;
    const next = async (): Promise<void> => {
      if (index < entries.length) {
        const entry = entries[index++];
        await entry.fn(ctx as any, next);
      }
    };

    await next();
  }

  // ── List all loaded plugins ──────────────────────────────────
  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  // ── Get a specific plugin ───────────────────────────────────
  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  // ── Get all loaded channels ─────────────────────────────────
  getChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  getChannel(name: string): Channel | undefined {
    return this.channels.get(name);
  }

  // ── Plugin count ────────────────────────────────────────────
  count(): { total: number; loaded: number; error: number; disabled: number } {
    const all = this.list();
    return {
      total: all.length,
      loaded: all.filter((p) => p.status === "loaded").length,
      error: all.filter((p) => p.status === "error").length,
      disabled: all.filter((p) => p.status === "disabled").length,
    };
  }

  // ── Enable/disable plugin in registry ────────────────────────
  async enable(name: string): Promise<boolean> {
    if (!this.registryFile.installed[name]) return false;
    this.registryFile.installed[name].enabled = true;
    await this.saveRegistryFile();
    return true;
  }

  async disable(name: string): Promise<boolean> {
    if (!this.registryFile.installed[name]) return false;
    this.registryFile.installed[name].enabled = false;
    await this.saveRegistryFile();
    return true;
  }

  // ── Registry file management ─────────────────────────────────
  private async loadRegistryFile(): Promise<void> {
    const regPath = join(this.globalDir, REGISTRY_FILENAME);
    try {
      if (existsSync(regPath)) {
        const raw = await readFile(regPath, "utf-8");
        this.registryFile = JSON.parse(raw);
      }
    } catch {
      this.registryFile = { version: 1, installed: {} };
    }
  }

  async saveRegistryFile(): Promise<void> {
    const regPath = join(this.globalDir, REGISTRY_FILENAME);
    await mkdir(this.globalDir, { recursive: true });
    await writeFile(
      regPath,
      JSON.stringify(this.registryFile, null, 2),
      "utf-8",
    );
  }

  // ── Register a newly installed plugin ────────────────────────
  async registerInstall(
    name: string,
    pluginDir: string,
    version: string,
    source: "local" | "npm" | "git" | "manual",
  ): Promise<void> {
    this.registryFile.installed[name] = {
      version,
      path: pluginDir,
      enabled: true,
      installedAt: new Date().toISOString(),
      source,
    };
    await this.saveRegistryFile();
  }

  // ── Unregister (remove from registry) ────────────────────────
  async unregisterInstall(name: string): Promise<void> {
    delete this.registryFile.installed[name];
    await this.saveRegistryFile();
  }

  // ── Get plugin directories ──────────────────────────────────
  getGlobalDir(): string {
    return this.globalDir;
  }

  getLocalDir(): string {
    return this.localDir;
  }

  getRegistryFile(): PluginRegistryFile {
    return this.registryFile;
  }
}

// ── Singleton instance ──────────────────────────────────────
export const pluginLoader = new PluginLoader();
