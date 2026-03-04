// ============================================================
// 🦀 Krab SDK — Tool Integration Helpers
// ============================================================
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { KrabSDK, ToolExecutionOptions, SDKResponse } from './index.js';

export interface ToolWrapper {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
  validateParams?: (params: any) => boolean | Promise<boolean>;
  transformResult?: (result: any) => any;
}

export interface ToolSet {
  name: string;
  description: string;
  version: string;
  tools: ToolWrapper[];
  metadata?: {
    author?: string;
    license?: string;
    repository?: string;
    keywords?: string[];
  };
}

export class ToolManager {
  private sdk: KrabSDK;
  private toolSets: Map<string, ToolSet> = new Map();
  private customTools: Map<string, ToolWrapper> = new Map();

  constructor(sdk: KrabSDK) {
    this.sdk = sdk;
  }

  // Register a tool set
  registerToolSet(toolSet: ToolSet): void {
    this.toolSets.set(toolSet.name, toolSet);
    console.log(`[ToolManager] Registered tool set: ${toolSet.name} (${toolSet.tools.length} tools)`);
  }

  // Unregister a tool set
  unregisterToolSet(name: string): boolean {
    const removed = this.toolSets.delete(name);
    if (removed) {
      console.log(`[ToolManager] Unregistered tool set: ${name}`);
    }
    return removed;
  }

  // Add a custom tool
  addCustomTool(tool: ToolWrapper): void {
    this.customTools.set(tool.name, tool);
    console.log(`[ToolManager] Added custom tool: ${tool.name}`);
  }

  // Remove a custom tool
  removeCustomTool(name: string): boolean {
    const removed = this.customTools.delete(name);
    if (removed) {
      console.log(`[ToolManager] Removed custom tool: ${name}`);
    }
    return removed;
  }

  // Execute a tool by name
  async executeTool(name: string, params: any, options: Partial<ToolExecutionOptions> = {}): Promise<SDKResponse<any>> {
    // Find tool in tool sets
    for (const toolSet of this.toolSets.values()) {
      const tool = toolSet.tools.find(t => t.name === name);
      if (tool) {
        return this.executeToolWrapper(tool, params, options);
      }
    }

    // Find tool in custom tools
    const customTool = this.customTools.get(name);
    if (customTool) {
      return this.executeToolWrapper(customTool, params, options);
    }

    return {
      success: false,
      error: `Tool not found: ${name}`,
      metadata: {
        requestId: `tool-${Date.now()}`,
        timestamp: new Date(),
        duration: 0
      }
    };
  }

  private async executeToolWrapper(
    tool: ToolWrapper,
    params: any,
    options: Partial<ToolExecutionOptions>
  ): Promise<SDKResponse<any>> {
    const startTime = Date.now();

    try {
      // Validate parameters if validator exists
      if (tool.validateParams) {
        const isValid = await tool.validateParams(params);
        if (!isValid) {
          return {
            success: false,
            error: `Invalid parameters for tool: ${tool.name}`,
            metadata: {
              requestId: `tool-${Date.now()}`,
              timestamp: new Date(),
              duration: Date.now() - startTime
            }
          };
        }
      }

      // Execute tool through SDK
      const result = await this.sdk.executeTool({
        tool: tool.name,
        parameters: params,
        ...options
      });

      // Transform result if transformer exists
      let finalResult = result.data;
      if (tool.transformResult && result.success) {
        finalResult = tool.transformResult(result.data);
      }

      return {
        success: result.success,
        data: finalResult,
        error: result.error,
        metadata: result.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          requestId: `tool-${Date.now()}`,
          timestamp: new Date(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  // Get available tools
  getAvailableTools(): Array<{ name: string; description: string; source: string }> {
    const tools: Array<{ name: string; description: string; source: string }> = [];

    // Add tools from tool sets
    for (const [setName, toolSet] of this.toolSets.entries()) {
      for (const tool of toolSet.tools) {
        tools.push({
          name: tool.name,
          description: tool.description,
          source: setName
        });
      }
    }

    // Add custom tools
    for (const [name, tool] of this.customTools.entries()) {
      tools.push({
        name,
        description: tool.description,
        source: 'custom'
      });
    }

    return tools;
  }

  // Get tool sets
  getToolSets(): Array<{ name: string; description: string; version: string; toolCount: number }> {
    return Array.from(this.toolSets.values()).map(set => ({
      name: set.name,
      description: set.description,
      version: set.version,
      toolCount: set.tools.length
    }));
  }

  // Create tool wrapper helper
  static createToolWrapper(
    name: string,
    description: string,
    executor: (params: any) => Promise<any>,
    options: {
      validateParams?: (params: any) => boolean | Promise<boolean>;
      transformResult?: (result: any) => any;
    } = {}
  ): ToolWrapper {
    return {
      name,
      description,
      execute: executor,
      validateParams: options.validateParams,
      transformResult: options.transformResult
    };
  }
}

// ── Pre-built Tool Sets ───────────────────────────────────────

// Web Tools Set
export const webToolsSet: ToolSet = {
  name: 'web-tools',
  description: 'Web browsing, searching, and content extraction tools',
  version: '1.0.0',
  tools: [
    ToolManager.createToolWrapper(
      'web_search',
      'Search the web for information',
      async (params: { query: string; limit?: number }) => {
        // This will be executed through Krab
        return { query: params.query, results: [] };
      },
      {
        validateParams: (params) => params && typeof params.query === 'string'
      }
    ),
    ToolManager.createToolWrapper(
      'web_fetch',
      'Fetch content from a web page',
      async (params: { url: string; format?: 'text' | 'html' | 'json' }) => {
        return { url: params.url, content: '' };
      },
      {
        validateParams: (params) => params && typeof params.url === 'string'
      }
    )
  ]
};

// File Tools Set
export const fileToolsSet: ToolSet = {
  name: 'file-tools',
  description: 'File system operations and content processing',
  version: '1.0.0',
  tools: [
    ToolManager.createToolWrapper(
      'file_read',
      'Read content from a file',
      async (params: { path: string; encoding?: string }) => {
        return { path: params.path, content: '' };
      },
      {
        validateParams: (params) => params && typeof params.path === 'string'
      }
    ),
    ToolManager.createToolWrapper(
      'file_write',
      'Write content to a file',
      async (params: { path: string; content: string; encoding?: string }) => {
        return { path: params.path, success: true };
      },
      {
        validateParams: (params) => params && typeof params.path === 'string' && typeof params.content === 'string'
      }
    )
  ]
};

// AI/ML Tools Set
export const aiToolsSet: ToolSet = {
  name: 'ai-tools',
  description: 'AI and machine learning tools',
  version: '1.0.0',
  tools: [
    ToolManager.createToolWrapper(
      'text_analyze',
      'Analyze text for sentiment, entities, and topics',
      async (params: { text: string; analysis: string[] }) => {
        return { text: params.text, analysis: {} };
      },
      {
        validateParams: (params) => params && typeof params.text === 'string'
      }
    ),
    ToolManager.createToolWrapper(
      'image_generate',
      'Generate images from text descriptions',
      async (params: { prompt: string; size?: string; style?: string }) => {
        return { prompt: params.prompt, imageUrl: '' };
      },
      {
        validateParams: (params) => params && typeof params.prompt === 'string'
      }
    )
  ]
};

// ── Plugin System ─────────────────────────────────────────────

export interface KrabPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];

  init?(sdk: KrabSDK): Promise<void>;
  destroy?(): Promise<void>;

  // Optional lifecycle hooks
  onConnect?(): void;
  onDisconnect?(): void;
  onError?(error: Error): void;
}

export class PluginManager {
  private sdk: KrabSDK;
  private plugins: Map<string, KrabPlugin> = new Map();
  private initializedPlugins: Set<string> = new Set();

  constructor(sdk: KrabSDK) {
    this.sdk = sdk;
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.sdk.on('connected', () => {
      for (const plugin of this.plugins.values()) {
        if (plugin.onConnect) {
          try {
            plugin.onConnect();
          } catch (error) {
            console.error(`Plugin ${plugin.name} onConnect error:`, error);
          }
        }
      }
    });

    this.sdk.on('disconnected', () => {
      for (const plugin of this.plugins.values()) {
        if (plugin.onDisconnect) {
          try {
            plugin.onDisconnect();
          } catch (error) {
            console.error(`Plugin ${plugin.name} onDisconnect error:`, error);
          }
        }
      }
    });

    this.sdk.on('error', (error) => {
      for (const plugin of this.plugins.values()) {
        if (plugin.onError) {
          try {
            plugin.onError(error);
          } catch (pluginError) {
            console.error(`Plugin ${plugin.name} onError error:`, pluginError);
          }
        }
      }
    });
  }

  async loadPlugin(plugin: KrabPlugin): Promise<boolean> {
    try {
      // Check dependencies
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!this.plugins.has(dep)) {
            throw new Error(`Missing dependency: ${dep}`);
          }
        }
      }

      this.plugins.set(plugin.name, plugin);
      console.log(`[PluginManager] Plugin loaded: ${plugin.name} v${plugin.version}`);

      return true;
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin ${plugin.name}:`, error);
      return false;
    }
  }

  async initializePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.error(`[PluginManager] Plugin not found: ${name}`);
      return false;
    }

    if (this.initializedPlugins.has(name)) {
      console.warn(`[PluginManager] Plugin already initialized: ${name}`);
      return true;
    }

    try {
      if (plugin.init) {
        await plugin.init(this.sdk);
      }

      this.initializedPlugins.add(name);
      console.log(`[PluginManager] Plugin initialized: ${name}`);

      return true;
    } catch (error) {
      console.error(`[PluginManager] Failed to initialize plugin ${name}:`, error);
      return false;
    }
  }

  async unloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    try {
      // Deinitialize if initialized
      if (this.initializedPlugins.has(name)) {
        if (plugin.destroy) {
          await plugin.destroy();
        }
        this.initializedPlugins.delete(name);
      }

      this.plugins.delete(name);
      console.log(`[PluginManager] Plugin unloaded: ${name}`);

      return true;
    } catch (error) {
      console.error(`[PluginManager] Failed to unload plugin ${name}:`, error);
      return false;
    }
  }

  getLoadedPlugins(): Array<{ name: string; version: string; description: string; initialized: boolean }> {
    return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
      name,
      version: plugin.version,
      description: plugin.description,
      initialized: this.initializedPlugins.has(name)
    }));
  }
}

// Factory functions
export function createToolManager(sdk: KrabSDK): ToolManager {
  return new ToolManager(sdk);
}

export function createPluginManager(sdk: KrabSDK): PluginManager {
  return new PluginManager(sdk);
}

// Export types
export type { ToolWrapper, ToolSet, KrabPlugin };

// Default exports
export default ToolManager;
