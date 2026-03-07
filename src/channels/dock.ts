// ============================================================
// 🦀 Krab — Dock Architecture (Plugin-based Channel Adapters)
// OpenClaw-inspired Dock System for dynamic channel loading
// ============================================================
import { logger } from "../utils/logger.js";
import { ChannelFactory, type BaseChannel, type ChannelConfig, type ChannelCapabilities } from "./base.js";

export interface DockManifest {
  name: string;
  version: string;
  description?: string;
  channel: {
    name: string;
    displayName: string;
    capabilities: ChannelCapabilities;
  };
  entry: string;
}

export interface DockChannelAdapter {
  manifest: DockManifest;
  channel: BaseChannel;
  status: "loaded" | "error" | "disabled";
  error?: string;
  loadedAt: Date;
}

export interface DockPlugin {
  name: string;
  version: string;
  adapters: Map<string, DockChannelAdapter>;
}

class DockSystem {
  private adapters = new Map<string, DockChannelAdapter>();
  private plugins = new Map<string, DockPlugin>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    logger.info("[Dock] Initializing Dock Architecture...");
    this.initialized = true;
    
    logger.info(`[Dock] Loaded ${this.adapters.size} channel adapters`);
  }

  registerAdapter(manifest: DockManifest, channel: BaseChannel): void {
    const adapter: DockChannelAdapter = {
      manifest,
      channel,
      status: "loaded",
      loadedAt: new Date(),
    };

    this.adapters.set(manifest.channel.name, adapter);
    
    let plugin = this.plugins.get(manifest.name);
    if (!plugin) {
      plugin = {
        name: manifest.name,
        version: manifest.version,
        adapters: new Map(),
      };
      this.plugins.set(manifest.name, plugin);
    }
    plugin.adapters.set(manifest.channel.name, adapter);

    ChannelFactory.register(manifest.channel.name, channel.constructor as any);
    
    logger.info(`[Dock] Registered channel adapter: ${manifest.channel.name} (${manifest.name} v${manifest.version})`);
  }

  getAdapter(name: string): DockChannelAdapter | undefined {
    return this.adapters.get(name);
  }

  getAllAdapters(): DockChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  getAdaptersByPlugin(pluginName: string): DockChannelAdapter[] {
    const plugin = this.plugins.get(pluginName);
    return plugin ? Array.from(plugin.adapters.values()) : [];
  }

  getPlugins(): DockPlugin[] {
    return Array.from(this.plugins.values());
  }

  async enableAdapter(name: string): Promise<boolean> {
    const adapter = this.adapters.get(name);
    if (!adapter) return false;

    try {
      await adapter.channel.start();
      adapter.status = "loaded";
      logger.info(`[Dock] Enabled adapter: ${name}`);
      return true;
    } catch (error) {
      adapter.status = "error";
      adapter.error = (error as Error).message;
      logger.error(`[Dock] Failed to enable ${name}:`, error);
      return false;
    }
  }

  async disableAdapter(name: string): Promise<boolean> {
    const adapter = this.adapters.get(name);
    if (!adapter) return false;

    try {
      await adapter.channel.stop();
      adapter.status = "disabled";
      logger.info(`[Dock] Disabled adapter: ${name}`);
      return true;
    } catch (error) {
      logger.error(`[Dock] Failed to disable ${name}:`, error);
      return false;
    }
  }

  getStatus(): {
    totalAdapters: number;
    loaded: number;
    error: number;
    disabled: number;
    plugins: number;
  } {
    const adapters = this.getAllAdapters();
    return {
      totalAdapters: adapters.length,
      loaded: adapters.filter(a => a.status === "loaded").length,
      error: adapters.filter(a => a.status === "error").length,
      disabled: adapters.filter(a => a.status === "disabled").length,
      plugins: this.plugins.size,
    };
  }

  async shutdown(): Promise<void> {
    logger.info("[Dock] Shutting down...");
    
    for (const adapter of this.adapters.values()) {
      if (adapter.status === "loaded") {
        try {
          await adapter.channel.stop();
        } catch (error) {
          logger.error(`[Dock] Error stopping ${adapter.manifest.channel.name}:`, error);
        }
      }
    }
    
    this.adapters.clear();
    this.plugins.clear();
    this.initialized = false;
    
    logger.info("[Dock] Shutdown complete");
  }
}

export const dockSystem = new DockSystem();
