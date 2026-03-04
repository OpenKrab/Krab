// ============================================================
// 🦀 Krab SDK — Main Entry Point
// ============================================================

// Core SDK
export {
  KrabSDK,
  KrabSDKBrowser,
  createKrabSDK,
  createKrabSDKBrowser
} from './index.js';

// Tool Integration
export {
  ToolManager,
  createToolManager,
  webToolsSet,
  fileToolsSet,
  aiToolsSet,
  ToolWrapper,
  ToolSet,
  type ToolWrapper,
  type ToolSet
} from './tools.js';

// Plugin System
export {
  PluginManager,
  createPluginManager,
  type KrabPlugin
} from './tools.js';

// Configuration Management
export {
  ConfigurationManager,
  createConfigurationManager,
  AuthenticationManager,
  createAuthenticationManager,
  type SDKEnvironment,
  type SDKProfile,
  type AuthCredentials
} from './config.js';

// Re-export types
export type {
  KrabSDKConfig,
  AgentConfig,
  ConversationOptions,
  ToolExecutionOptions,
  SDKResponse,
  CloudConfig,
  ChatMessage,
  ChatResponse,
  ToolExecution,
  ToolResult
} from './index.js';

// Utility functions
export function createKrabSDKWithTools(config?: KrabSDKConfig) {
  const sdk = createKrabSDK(config);
  const toolManager = createToolManager(sdk);
  const pluginManager = createPluginManager(sdk);
  const configManager = createConfigurationManager();
  const authManager = createAuthenticationManager(configManager);

  return {
    sdk,
    toolManager,
    pluginManager,
    configManager,
    authManager,
    // Convenience methods
    async connect() {
      return sdk.connect();
    },
    async sendMessage(message: string, options?: any) {
      return sdk.sendMessage(message, options);
    },
    async executeTool(tool: string, params: any, options?: any) {
      return toolManager.executeTool(tool, params, options);
    },
    disconnect() {
      sdk.disconnect();
    }
  };
}

// Default export
export default KrabSDK;

// Version info
export const VERSION = '1.0.0';
export const SDK_NAME = 'Krab SDK';
export const DESCRIPTION = 'Software Development Kit for Krab AGI Agent Framework';
