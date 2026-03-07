// ============================================================
// 🦀 Krab — Plugin System
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const PluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  krabVersion: z.string().optional(),
  channels: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  hooks: z.array(z.string()).optional(),
  entry: z.string().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface Plugin {
  manifest: PluginManifest;
  path: string;
  loaded: boolean;
  enabled: boolean;
  instance?: any;
}

export interface PluginHook {
  name: string;
  handler: (context: any) => Promise<any>;
}

export interface PluginAPI {
  registerTool: (name: string, tool: any) => void;
  registerHook: (name: string, handler: (context: any) => Promise<any>) => void;
  registerChannel: (channel: any) => void;
  getConfig: () => any;
  setConfig: (key: string, value: any) => void;
  logger: typeof logger;
}

export class PluginLoader {
  private plugins = new Map<string, Plugin>();
  private tools = new Map<string, any>();
  private hooks = new Map<string, PluginHook[]>();
  private pluginDir: string;

  constructor(pluginDir?: string) {
    this.pluginDir = pluginDir || path.join(process.cwd(), ".krab", "plugins");
  }

  async loadPlugin(pluginPath: string): Promise<Plugin> {
    const manifestPath = path.join(pluginPath, "package.json");
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }

    const manifest = PluginManifestSchema.parse(
      JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    );

    if (this.plugins.has(manifest.name)) {
      logger.warn(`[PluginLoader] Plugin already loaded: ${manifest.name}`);
      return this.plugins.get(manifest.name)!;
    }

    const plugin: Plugin = {
      manifest,
      path: pluginPath,
      loaded: false,
      enabled: true,
    };

    if (manifest.entry) {
      const entryPath = path.join(pluginPath, manifest.entry);
      
      try {
        const module = await import(entryPath);
        
        if (module.default) {
          const api = this.createPluginAPI(plugin);
          plugin.instance = new module.default(api);
          
          if (typeof plugin.instance.init === "function") {
            await plugin.instance.init();
          }
        }
        
        plugin.loaded = true;
        logger.info(`[PluginLoader] Loaded plugin: ${manifest.name}@${manifest.version}`);
      } catch (error) {
        logger.error(`[PluginLoader] Failed to load plugin ${manifest.name}:`, error);
        throw error;
      }
    }

    this.plugins.set(manifest.name, plugin);
    this.registerPluginResources(plugin);

    return plugin;
  }

  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
      logger.info(`[PluginLoader] Created plugin directory: ${this.pluginDir}`);
      return;
    }

    const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const pluginPath = path.join(this.pluginDir, entry.name);
      
      try {
        await this.loadPlugin(pluginPath);
      } catch (error) {
        logger.error(`[PluginLoader] Failed to load plugin from ${pluginPath}:`, error);
      }
    }

    logger.info(`[PluginLoader] Loaded ${this.plugins.size} plugins`);
  }

  async unloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.instance && typeof plugin.instance.destroy === "function") {
      await plugin.instance.destroy();
    }

    this.unregisterPluginResources(plugin);
    this.plugins.delete(name);
    
    logger.info(`[PluginLoader] Unloaded plugin: ${name}`);
    return true;
  }

  enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    plugin.enabled = true;
    logger.info(`[PluginLoader] Enabled plugin: ${name}`);
    return true;
  }

  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    plugin.enabled = false;
    logger.info(`[PluginLoader] Disabled plugin: ${name}`);
    return true;
  }

  private createPluginAPI(plugin: Plugin): PluginAPI {
    return {
      registerTool: (name: string, tool: any) => {
        this.tools.set(`${plugin.manifest.name}:${name}`, tool);
        logger.debug(`[PluginAPI.${plugin.manifest.name}] Registered tool: ${name}`);
      },
      
      registerHook: (name: string, handler: (context: any) => Promise<any>) => {
        const hook: PluginHook = { name, handler };
        const hooks = this.hooks.get(name) || [];
        hooks.push(hook);
        this.hooks.set(name, hooks);
        logger.debug(`[PluginAPI.${plugin.manifest.name}] Registered hook: ${name}`);
      },
      
      registerChannel: (channel: any) => {
        logger.debug(`[PluginAPI.${plugin.manifest.name}] Registered channel`);
      },
      
      getConfig: () => {
        return {};
      },
      
      setConfig: (key: string, value: any) => {
        logger.debug(`[PluginAPI.${plugin.manifest.name}] Config set: ${key}`);
      },
      
      logger,
    };
  }

  private registerPluginResources(plugin: Plugin): void {
    if (plugin.manifest.tools) {
      for (const tool of plugin.manifest.tools) {
        logger.debug(`[PluginLoader] Plugin ${plugin.manifest.name} provides tool: ${tool}`);
      }
    }

    if (plugin.manifest.hooks) {
      for (const hook of plugin.manifest.hooks) {
        logger.debug(`[PluginLoader] Plugin ${plugin.manifest.name} provides hook: ${hook}`);
      }
    }
  }

  private unregisterPluginResources(plugin: Plugin): void {
    const prefix = `${plugin.manifest.name}:`;
    
    for (const [key] of this.tools) {
      if (key.startsWith(prefix)) {
        this.tools.delete(key);
      }
    }

    for (const [hookName, handlers] of this.hooks) {
      const filtered = handlers.filter(
        (h) => !h.name.startsWith(prefix)
      );
      this.hooks.set(hookName, filtered);
    }
  }

  async executeHook(hookName: string, context: any): Promise<any[]> {
    const handlers = this.hooks.get(hookName) || [];
    const results: any[] = [];

    for (const hook of handlers) {
      try {
        const result = await hook.handler(context);
        results.push(result);
      } catch (error) {
        logger.error(`[PluginLoader] Hook ${hookName} failed:`, error);
      }
    }

    return results;
  }

  getTool(name: string): any {
    return this.tools.get(name);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  listEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.enabled);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  listHooks(): string[] {
    return Array.from(this.hooks.keys());
  }
}

// ── Plugin Manager (Singleton) ─────────────────────────────────

class PluginManagerInstance {
  private loader: PluginLoader;
  private initialized = false;

  constructor() {
    this.loader = new PluginLoader();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.loader.loadAll();
    this.initialized = true;
    
    logger.info("[PluginManager] Initialized");
  }

  async shutdown(): Promise<void> {
    for (const plugin of this.loader.listPlugins()) {
      await this.loader.unloadPlugin(plugin.manifest.name);
    }
    
    this.initialized = false;
    logger.info("[PluginManager] Shutdown complete");
  }

  getLoader(): PluginLoader {
    return this.loader;
  }
}

export const PluginManager = new PluginManagerInstance();

// ── Plugin Template Generator ───────────────────────────────────

export function generatePluginTemplate(name: string): string {
  return `{
  "name": "${name}",
  "version": "1.0.0",
  "description": "Krab plugin",
  "krabVersion": ">=0.1.0",
  "main": "dist/index.js",
  "channels": [],
  "tools": [],
  "hooks": ["beforeMessage", "afterMessage"]
}
`;
}

export function generatePluginEntryCode(): string {
  return `import type { PluginAPI } from "@krab/core";

export default class MyPlugin {
  private api: PluginAPI;

  constructor(api: PluginAPI) {
    this.api = api;
  }

  async init() {
    this.api.logger.info("MyPlugin initialized");
    
    this.api.registerHook("beforeMessage", async (context) => {
      // Handle before message
      return context;
    });

    this.api.registerTool("myTool", {
      name: "myTool",
      description: "My custom tool",
      parameters: {},
      execute: async (params) => {
        return { result: "success" };
      }
    });
  }

  async destroy() {
    this.api.logger.info("MyPlugin destroyed");
  }
}
`;
}
