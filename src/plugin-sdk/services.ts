// ============================================================
// 🦀 Krab — Plugin SDK: Services
// Services available to plugins via the runtime
// ============================================================
import type { ToolDefinition, ToolResult } from "../core/types.js";
import { registry } from "../tools/registry.js";

export interface PluginServicesHandle {
  // Tool execution
  invokeTool(name: string, args: any): Promise<ToolResult>;
  
  // Channel access
  getChannel(id: string): any;
  listChannels(): Array<{ id: string; name: string }>;
  
  // Agent access
  getAgent(sessionId?: string): any;
  
  // Storage
  getStorage(namespace: string): {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };
  
  // HTTP fetch (with plugin's auth)
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

export function createPluginServicesHandle(pluginId: string): PluginServicesHandle {
  return {
    async invokeTool(name: string, args: any): Promise<ToolResult> {
      const tool = registry.get(name);
      if (!tool) {
        return { success: false, output: null, error: `Tool not found: ${name}` };
      }
      
      try {
        const result = await tool.execute(args);
        return { success: true, output: result };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    
    getChannel(id: string) {
      // Would integrate with ChannelManager
      return null;
    },
    
    listChannels() {
      // Would list from ChannelManager
      return [];
    },
    
    getAgent(sessionId?: string) {
      // Would get from Agent manager
      return null;
    },
    
    getStorage(namespace: string) {
      // Simple in-memory storage per plugin
      const storage = new Map<string, any>();
      
      return {
        async get<T>(key: string): Promise<T | undefined> {
          return storage.get(`${namespace}:${key}`) as T | undefined;
        },
        async set<T>(key: string, value: T): Promise<void> {
          storage.set(`${namespace}:${key}`, value);
        },
        async delete(key: string): Promise<void> {
          storage.delete(`${namespace}:${key}`);
        },
      };
    },
    
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      return fetch(url, options);
    },
  };
}
