// ============================================================
// 🦀 Krab — MCP Server (Model Context Protocol)
// ============================================================
import { logger } from "../utils/logger.js";
import { registry as toolRegistry } from "../tools/registry.js";

// Dynamic imports for optional dependencies
let WebSocket: any = null;

export interface MCPServerOptions {
  port?: number;
  websocket?: boolean;
  allowedOrigins?: string[];
}

export interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class MCPServer {
  private port: number;
  private websocket: boolean;
  private allowedOrigins: string[];
  private server: any = null;
  private wss: any = null;
  private connections = new Set<any>();

  constructor(options: MCPServerOptions = {}) {
    this.port = options.port || 3001;
    this.websocket = options.websocket ?? true;
    this.allowedOrigins = options.allowedOrigins || ['*'];
  }

  async start(): Promise<void> {
    try {
      if (this.websocket) {
        await this.startWebSocketServer();
      } else {
        await this.startHTTPServer();
      }

      logger.info(`[MCP] Server started on port ${this.port} (${this.websocket ? 'WebSocket' : 'HTTP'})`);
    } catch (error) {
      logger.error("[MCP] Failed to start server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.connections.clear();
    logger.info("[MCP] Server stopped");
  }

  private async startWebSocketServer(): Promise<void> {
    // Dynamic import for WebSocket
    const wsModule = await import("ws").catch(() => null);
    if (!wsModule) {
      throw new Error("WebSocket support not available. Install ws package.");
    }
    WebSocket = wsModule.WebSocket || wsModule.default;

    const http = await import("http");

    this.server = http.createServer();
    this.wss = new wsModule.WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: any, request: any) => {
      this.handleWebSocketConnection(ws, request);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => resolve());
      this.server.on('error', reject);
    });
  }

  private async startHTTPServer(): Promise<void> {
    const http = await import("http");

    this.server = http.createServer(async (req, res) => {
      // Handle CORS
      const origin = req.headers.origin;
      if (this.allowedOrigins.includes('*') || this.allowedOrigins.includes(origin as string)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          const response = await this.handleRequest(request);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          logger.error("[MCP] HTTP request error:", error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => resolve());
      this.server.on('error', reject);
    });
  }

  private handleWebSocketConnection(ws: any, request: any): void {
    this.connections.add(ws);

    ws.on('message', async (data: Buffer) => {
      try {
        const request = JSON.parse(data.toString());
        const response = await this.handleRequest(request);
        ws.send(JSON.stringify(response));
      } catch (error) {
        logger.error("[MCP] WebSocket message error:", error);
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" }
        }));
      }
    });

    ws.on('close', () => {
      this.connections.delete(ws);
    });

    ws.on('error', (error: any) => {
      logger.error("[MCP] WebSocket error:", error);
      this.connections.delete(ws);
    });
  }

  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id: request.id
    };

    try {
      switch (request.method) {
        case 'initialize':
          response.result = await this.handleInitialize(request.params);
          break;

        case 'tools/list':
          response.result = await this.handleToolsList();
          break;

        case 'tools/call':
          response.result = await this.handleToolCall(request.params);
          break;

        default:
          response.error = {
            code: -32601,
            message: `Method '${request.method}' not found`
          };
      }
    } catch (error: any) {
      response.error = {
        code: -32603,
        message: error.message || 'Internal error'
      };
    }

    return response;
  }

  private async handleInitialize(params: any): Promise<any> {
    logger.info("[MCP] Client initialized:", params.clientInfo);

    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: {
        name: "krab",
        version: "0.1.0"
      }
    };
  }

  private async handleToolsList(): Promise<any> {
    const tools = toolRegistry.getAll().map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return { tools };
  }

  private async handleToolCall(params: any): Promise<any> {
    const { name, arguments: args = {} } = params;

    logger.info(`[MCP] Tool call: ${name}`, args);

    try {
      const result = await toolRegistry.executeTool(name, args);
      return result;
    } catch (error: any) {
      logger.error(`[MCP] Tool execution error for '${name}':`, error);
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  isRunning(): boolean {
    return this.server && this.server.listening;
  }
}

// Factory function for creating MCP servers
export function createMCPServer(options: MCPServerOptions): MCPServer {
  return new MCPServer(options);
}

// Export for dynamic loading
export default MCPServer;
