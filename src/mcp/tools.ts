// ============================================================
// 🦀 Krab — MCP Tools (Model Context Protocol)
// ============================================================
import { MCPClient, MCPClientOptions } from './client.js';
import { MCPServer } from './server.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface MCPConnectionOptions {
  transport: 'stdio' | 'websocket';
  command?: string;
  args?: string[];
  websocketUrl?: string;
  timeout?: number;
  name?: string;
}

export class MCPTools {
  private clients: Map<string, MCPClient> = new Map();
  private servers: Map<string, MCPServer> = new Map();

  // Client operations
  async connectToMCP(name: string, options: MCPConnectionOptions): Promise<boolean> {
    try {
      logger.info(`[MCPTools] Connecting to MCP server: ${name}`);

      const clientOptions: MCPClientOptions = {
        transport: options.transport,
        timeout: options.timeout || 30000,
        retryAttempts: 3,
        retryDelay: 1000
      };

      if (options.transport === 'stdio') {
        clientOptions.command = options.command ? [options.command] : undefined;
        clientOptions.args = options.args || [];
      } else {
        clientOptions.url = options.websocketUrl;
      }

      const client = new MCPClient(clientOptions);
      await client.connect();

      this.clients.set(name, client);
      logger.info(`[MCPTools] Connected to MCP server: ${name}`);

      return true;
    } catch (error) {
      logger.error(`[MCPTools] Failed to connect to MCP server ${name}:`, error);
      return false;
    }
  }

  async disconnectFromMCP(name: string): Promise<boolean> {
    try {
      const client = this.clients.get(name);
      if (!client) return false;

      client.disconnect();
      this.clients.delete(name);
      logger.info(`[MCPTools] Disconnected from MCP server: ${name}`);

      return true;
    } catch (error) {
      logger.error(`[MCPTools] Failed to disconnect from MCP server ${name}:`, error);
      return false;
    }
  }

  async listMCPTools(serverName: string): Promise<any[]> {
    try {
      const client = this.clients.get(serverName);
      if (!client) {
        throw new Error(`MCP server not connected: ${serverName}`);
      }

      const tools = await client.listTools();
      return tools;
    } catch (error) {
      logger.error(`[MCPTools] Failed to list tools from ${serverName}:`, error);
      throw error;
    }
  }

  async callMCPTool(serverName: string, toolName: string, args: any = {}): Promise<any> {
    try {
      const client = this.clients.get(serverName);
      if (!client) {
        throw new Error(`MCP server not connected: ${serverName}`);
      }

      logger.info(`[MCPTools] Calling tool ${toolName} on server ${serverName}`);
      const result = await client.callTool(toolName, args);
      return result;
    } catch (error) {
      logger.error(`[MCPTools] Failed to call tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  async listMCPResources(serverName: string): Promise<any[]> {
    try {
      const client = this.clients.get(serverName);
      if (!client) {
        throw new Error(`MCP server not connected: ${serverName}`);
      }

      const resources = await client.listResources();
      return resources;
    } catch (error) {
      logger.error(`[MCPTools] Failed to list resources from ${serverName}:`, error);
      throw error;
    }
  }

  async readMCPResource(serverName: string, uri: string): Promise<any> {
    try {
      const client = this.clients.get(serverName);
      if (!client) {
        throw new Error(`MCP server not connected: ${serverName}`);
      }

      const resource = await client.readResource(uri);
      return resource;
    } catch (error) {
      logger.error(`[MCPTools] Failed to read resource ${uri} from ${serverName}:`, error);
      throw error;
    }
  }

  // Server operations
  async startMCPServer(name: string, port: number = 3001): Promise<boolean> {
    try {
      logger.info(`[MCPTools] Starting MCP server: ${name} on port ${port}`);

      const server = new MCPServer({
        port,
        websocket: true,
        allowedOrigins: ['*'] // TODO: Make configurable
      });

      await server.start();
      this.servers.set(name, server);

      logger.info(`[MCPTools] MCP server started: ${name}`);
      return true;
    } catch (error) {
      logger.error(`[MCPTools] Failed to start MCP server ${name}:`, error);
      return false;
    }
  }

  async stopMCPServer(name: string): Promise<boolean> {
    try {
      const server = this.servers.get(name);
      if (!server) return false;

      await server.stop();
      this.servers.delete(name);
      logger.info(`[MCPTools] MCP server stopped: ${name}`);

      return true;
    } catch (error) {
      logger.error(`[MCPTools] Failed to stop MCP server ${name}:`, error);
      return false;
    }
  }

  // Discovery and registration
  async discoverMCPServers(networkScan: boolean = false): Promise<any[]> {
    // TODO: Implement network discovery of MCP servers
    // For now, return configured servers
    const configuredServers = [
      {
        name: 'local-mcp-server',
        url: 'ws://localhost:3001',
        description: 'Local Krab MCP server'
      }
    ];

    if (networkScan) {
      // TODO: Implement network scanning
      logger.info('[MCPTools] Network scanning not implemented yet');
    }

    return configuredServers;
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getRunningServers(): string[] {
    return Array.from(this.servers.keys());
  }

  // Inter-agent communication
  async sendMessageToAgent(recipient: string, message: any): Promise<boolean> {
    try {
      // Find the MCP client connected to the recipient agent
      for (const [clientName, client] of this.clients.entries()) {
        if (clientName.includes(recipient) && client.isConnected()) {
          // TODO: Implement inter-agent messaging protocol
          await client.sendNotification('agent/message', {
            from: 'krab',
            to: recipient,
            message,
            timestamp: new Date().toISOString()
          });
          return true;
        }
      }

      logger.warn(`[MCPTools] No connected client found for agent: ${recipient}`);
      return false;
    } catch (error) {
      logger.error(`[MCPTools] Failed to send message to agent ${recipient}:`, error);
      return false;
    }
  }

  async broadcastMessage(message: any, excludeSelf: boolean = true): Promise<number> {
    let sentCount = 0;

    try {
      for (const [clientName, client] of this.clients.entries()) {
        if (excludeSelf && clientName === 'self') continue;

        if (client.isConnected()) {
          await client.sendNotification('agent/broadcast', {
            from: 'krab',
            message,
            timestamp: new Date().toISOString()
          });
          sentCount++;
        }
      }

      logger.info(`[MCPTools] Broadcast message sent to ${sentCount} agents`);
      return sentCount;
    } catch (error) {
      logger.error('[MCPTools] Broadcast failed:', error);
      return sentCount;
    }
  }
}

// ── MCP Integration Tool ────────────────────────────────────
export const mcpIntegrationTool: Tool = {
  name: "mcp_integration",
  description: "Model Context Protocol integration for connecting to other MCP-compatible agents and tools.",
  parameters: z.object({
    action: z.enum(["connect", "disconnect", "list_tools", "call_tool", "list_resources", "read_resource", "start_server", "stop_server", "discover", "send_message", "broadcast"]).describe("MCP action to perform"),
    serverName: z.string().optional().describe("MCP server name"),
    serverUrl: z.string().optional().describe("MCP server WebSocket URL"),
    serverCommand: z.string().optional().describe("MCP server command for stdio"),
    serverArgs: z.array(z.string()).optional().describe("MCP server command arguments"),
    toolName: z.string().optional().describe("Tool name to call"),
    toolArgs: z.record(z.string(), z.any()).optional().describe("Tool arguments"),
    resourceUri: z.string().optional().describe("Resource URI to read"),
    port: z.number().optional().describe("Port for MCP server"),
    recipient: z.string().optional().describe("Recipient agent for messaging"),
    message: z.any().optional().describe("Message to send"),
    networkScan: z.boolean().optional().describe("Enable network scanning for discovery")
  }),

  async execute(args: any): Promise<ToolResult> {
    const mcpTools = new MCPTools();

    try {
      switch (args.action) {
        case 'connect':
          if (!args.serverName) {
            throw new Error('Server name is required for connection');
          }

          const connectionOptions: MCPConnectionOptions = {
            name: args.serverName,
            transport: args.serverUrl ? 'websocket' : 'stdio',
            websocketUrl: args.serverUrl,
            command: args.serverCommand,
            args: args.serverArgs,
            timeout: 30000
          };

          const connected = await mcpTools.connectToMCP(args.serverName, connectionOptions);
          return {
            success: connected,
            output: connected ? `Connected to MCP server: ${args.serverName}` : `Failed to connect to MCP server: ${args.serverName}`
          };

        case 'disconnect':
          if (!args.serverName) {
            throw new Error('Server name is required for disconnection');
          }

          const disconnected = await mcpTools.disconnectFromMCP(args.serverName);
          return {
            success: disconnected,
            output: disconnected ? `Disconnected from MCP server: ${args.serverName}` : `Server not found: ${args.serverName}`
          };

        case 'list_tools':
          if (!args.serverName) {
            throw new Error('Server name is required');
          }

          const tools = await mcpTools.listMCPTools(args.serverName);
          return {
            success: true,
            output: JSON.stringify({
              server: args.serverName,
              tools: tools.map(t => ({ name: t.name, description: t.description }))
            }, null, 2)
          };

        case 'call_tool':
          if (!args.serverName || !args.toolName) {
            throw new Error('Server name and tool name are required');
          }

          const toolResult = await mcpTools.callMCPTool(args.serverName, args.toolName, args.toolArgs || {});
          return {
            success: true,
            output: JSON.stringify({
              server: args.serverName,
              tool: args.toolName,
              result: toolResult
            }, null, 2)
          };

        case 'list_resources':
          if (!args.serverName) {
            throw new Error('Server name is required');
          }

          const resources = await mcpTools.listMCPResources(args.serverName);
          return {
            success: true,
            output: JSON.stringify({
              server: args.serverName,
              resources: resources.map(r => ({ uri: r.uri, name: r.name, description: r.description }))
            }, null, 2)
          };

        case 'read_resource':
          if (!args.serverName || !args.resourceUri) {
            throw new Error('Server name and resource URI are required');
          }

          const resource = await mcpTools.readMCPResource(args.serverName, args.resourceUri);
          return {
            success: true,
            output: JSON.stringify({
              server: args.serverName,
              uri: args.resourceUri,
              content: resource
            }, null, 2)
          };

        case 'start_server':
          if (!args.serverName) {
            throw new Error('Server name is required');
          }

          const serverStarted = await mcpTools.startMCPServer(args.serverName, args.port || 3001);
          return {
            success: serverStarted,
            output: serverStarted ? `MCP server started: ${args.serverName}` : `Failed to start MCP server: ${args.serverName}`
          };

        case 'stop_server':
          if (!args.serverName) {
            throw new Error('Server name is required');
          }

          const serverStopped = await mcpTools.stopMCPServer(args.serverName);
          return {
            success: serverStopped,
            output: serverStopped ? `MCP server stopped: ${args.serverName}` : `Server not found: ${args.serverName}`
          };

        case 'discover':
          const servers = await mcpTools.discoverMCPServers(args.networkScan);
          return {
            success: true,
            output: JSON.stringify({
              discoveredServers: servers.length,
              servers
            }, null, 2)
          };

        case 'send_message':
          if (!args.recipient || !args.message) {
            throw new Error('Recipient and message are required');
          }

          const messageSent = await mcpTools.sendMessageToAgent(args.recipient, args.message);
          return {
            success: messageSent,
            output: messageSent ? `Message sent to agent: ${args.recipient}` : `Failed to send message to agent: ${args.recipient}`
          };

        case 'broadcast':
          if (!args.message) {
            throw new Error('Message is required for broadcast');
          }

          const broadcastCount = await mcpTools.broadcastMessage(args.message);
          return {
            success: true,
            output: `Message broadcast to ${broadcastCount} agents`
          };

        default:
          throw new Error(`Unknown MCP action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[MCPIntegrationTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `MCP action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createMCPTools(): MCPTools {
  return new MCPTools();
}

// Export for dynamic loading
export default MCPTools;
