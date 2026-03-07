// ============================================================
// 🦀 Krab — Plugin SDK: Plugin Runtime
// Runtime context for plugins
// ============================================================
import { logger } from "../utils/logger.js";
import type { ToolDefinition } from "../core/types.js";

export interface PluginRuntimeContext {
  pluginId: string;
  pluginDir: string;
  config: Record<string, any>;
  version: string;
  
  // Services available to plugin
  getConfig(key: string): any;
  setConfig(key: string, value: any): void;
  getDataPath(): string;
  getDataPath(relative: string): string;
  
  // Tool registration
  registerTool(tool: ToolDefinition): void;
  registerTools(tools: ToolDefinition[]): void;
  
  // Logging
  log: typeof logger;
}

export interface PluginRuntime {
  readonly context: PluginRuntimeContext;
  readonly isReady: boolean;
  
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export function createPluginRuntime(
  pluginId: string,
  pluginDir: string,
  config: Record<string, any> = {},
  version: string = "1.0.0"
): PluginRuntime {
  const runtimeConfig = { ...config };
  const registeredTools: ToolDefinition[] = [];
  let ready = false;
  
  const context: PluginRuntimeContext = {
    pluginId,
    pluginDir,
    config: runtimeConfig,
    version,
    
    getDataPath(relative: string = ""): string {
      return relative
        ? `${pluginDir}/data/${relative}`
        : `${pluginDir}/data`;
    },
    
    getConfig(key: string): any {
      return runtimeConfig[key];
    },
    
    setConfig(key: string, value: any): void {
      runtimeConfig[key] = value;
    },
    
    registerTool(tool: ToolDefinition): void {
      registeredTools.push(tool);
      logger.info(`[Plugin:${pluginId}] Registered tool: ${tool.name}`);
    },
    
    registerTools(tools: ToolDefinition[]): void {
      for (const tool of tools) {
        this.registerTool(tool);
      }
    },
    
    log: logger,
  };
  
  return {
    get context() {
      return context;
    },
    
    get isReady(): boolean {
      return ready;
    },
    
    async initialize(): Promise<void> {
      logger.info(`[Plugin:${pluginId}] Initializing...`);
      ready = true;
      logger.info(`[Plugin:${pluginId}] Ready`);
    },
    
    async shutdown(): Promise<void> {
      logger.info(`[Plugin:${pluginId}] Shutting down...`);
      ready = false;
      registeredTools.length = 0;
      logger.info(`[Plugin:${pluginId}] Stopped`);
    },
  };
}
