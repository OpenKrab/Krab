// ============================================================
// 🦀 Krab — MCP Index (Model Context Protocol)
// ============================================================
import { mcpIntegrationTool, createMCPTools } from './tools.js';
import { MCPClient, createMCPClient } from './client.js';
import { MCPServer, createMCPServer } from './server.js';

// Re-export everything
export {
  mcpIntegrationTool,
  createMCPTools,
  MCPClient,
  createMCPClient,
  MCPServer,
  createMCPServer
};

// Re-export types
export type {
  MCPConnectionOptions
} from './tools.js';

export type {
  MCPClientOptions,
  MCPTool
} from './client.js';

export type {
  MCPServerOptions,
  MCPRequest,
  MCPResponse
} from './server.js';

// MCP tools collection for easy registration
export const mcpTools = [
  mcpIntegrationTool
];
