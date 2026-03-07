// ============================================================
// Krab SDK - Main Entry Point
// ============================================================
import KrabSDK, {
  createKrabSDK,
  type AgentConfig,
  type ConversationOptions,
  type KrabSDKConfig,
  type SDKResponse,
  type ToolExecutionOptions,
} from "./index.js";
import {
  PluginManager,
  ToolManager,
  createPluginManager,
  createToolManager,
} from "./tools.js";
import {
  AuthenticationManager,
  ConfigurationManager,
  createAuthenticationManager,
  createConfigurationManager,
  type AuthCredentials,
  type SDKEnvironment,
  type SDKProfile,
} from "./config.js";

export {
  KrabSDK,
  createKrabSDK,
  ToolManager,
  createToolManager,
  PluginManager,
  createPluginManager,
  ConfigurationManager,
  createConfigurationManager,
  AuthenticationManager,
  createAuthenticationManager,
};
export {
  KrabSDKBrowser,
  createKrabSDKBrowser,
} from "./index.js";
export {
  webToolsSet,
  fileToolsSet,
  aiToolsSet,
  type KrabPlugin,
  type ToolSet,
  type ToolWrapper,
} from "./tools.js";
export type {
  KrabSDKConfig,
  AgentConfig,
  ConversationOptions,
  ToolExecutionOptions,
  SDKResponse,
} from "./index.js";
export type { AuthCredentials, SDKEnvironment, SDKProfile } from "./config.js";

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
    async connect() {
      return sdk.connect();
    },
    async sendMessage(message: string, options?: ConversationOptions) {
      return sdk.sendMessage(message, options);
    },
    async executeTool(
      tool: string,
      params: any,
      options?: Partial<ToolExecutionOptions>,
    ): Promise<SDKResponse<any>> {
      return toolManager.executeTool(tool, params, options);
    },
    disconnect() {
      sdk.disconnect();
    },
  };
}

export default KrabSDK;

export const VERSION = "1.0.0";
export const SDK_NAME = "Krab SDK";
export const DESCRIPTION = "Software Development Kit for Krab AGI Agent Framework";
