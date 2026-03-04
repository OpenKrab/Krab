// ============================================================
// 🦀 Krab — Main Entry Point
// ============================================================
export { Agent } from "./core/agent.js";
export { loadConfig } from "./core/config.js";
export { registry } from "./tools/registry.js";
export { ConversationMemory } from "./memory/conversation.js";
export { generateStructured, generateTextResponse } from "./providers/llm.js";
export type * from "./core/types.js";

// MCP exports
export { MCPClient, createMCPClient } from "./mcp/client.js";
export { MCPServer, createMCPServer } from "./mcp/server.js";
export { mcpIntegrationTool, createMCPTools, MCPTools } from "./mcp/tools.js";
export type { MCPConnectionOptions } from "./mcp/tools.js";
export type { MCPClientOptions, MCPTool, MCPResource, MCPMessage } from "./mcp/client.js";
export type { MCPServerOptions, MCPRequest, MCPResponse } from "./mcp/server.js";

// Re-export ConversationMemory class for direct instantiation
export { ConversationMemory as Memory } from "./memory/conversation.js";
