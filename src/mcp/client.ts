// ============================================================
// 🦀 Krab — MCP Client (Model Context Protocol)
// ============================================================
import { spawn } from "child_process";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let WebSocket: any = null;

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPMessage {
  method: string;
  params?: any;
}

export interface MCPClientOptions {
  transport?: 'stdio' | 'websocket';
  command?: string[];
  args?: string[];
  url?: string;
  websocketUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: NodeJS.Timeout;
};

export class MCPClient {
  private process: any = null;
  private websocket: any = null;
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private connected = false;
  private options: MCPClientOptions;
  private pendingRequests: Map<number | string, PendingRequest> = new Map();
  private notificationHandlers: Map<string, ((params: any) => void)[]> = new Map();
  private clientInfo: any = null;
  private serverCapabilities: any = null;
  private protocolVersion: string = "2024-11-05";
  private requestId = 1;

  constructor(options: MCPClientOptions = {}) {
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  async connect(): Promise<void> {
    try {
      if (this.options.websocketUrl) {
        await this.connectWebSocket();
      } else if (this.options.command) {
        await this.connectStdio();
      } else {
        throw new Error("Either websocketUrl or command must be provided");
      }

      // Initialize connection and discover tools
      await this.initialize();
      this.connected = true;
      logger.info("[MCP] Client connected successfully");
    } catch (error) {
      logger.error("[MCP] Failed to connect:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.connected = false;
    this.tools.clear();
    this.resources.clear();
    this.notificationHandlers.clear();
    logger.info("[MCP] Client disconnected");
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error("MCP client is not connected");
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    try {
      const request = {
        jsonrpc: "2.0",
        id: this.generateRequestId(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      };

      const response = await this.sendRequest(request);
      return response.result;
    } catch (error) {
      logger.error(`[MCP] Tool call failed for '${toolName}':`, error);
      throw error;
    }
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getAvailableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  getServerInfo(): any {
    return this.clientInfo;
  }

  getServerCapabilities(): any {
    return this.serverCapabilities;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async connectStdio(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { command, args = [] } = this.options;

      this.process = spawn(command![0], [...command!.slice(1), ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.on('error', (error: any) => {
        logger.error("[MCP] Process error:", error);
        reject(error);
      });

      this.process.on('exit', (code: number) => {
        logger.warn(`[MCP] Process exited with code ${code}`);
        this.connected = false;
      });

      // Set up message handling
      this.setupStdioMessaging();

      // Wait for process to be ready
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          resolve();
        } else {
          reject(new Error("Process failed to start"));
        }
      }, 1000);
    });
  }

  private async connectWebSocket(): Promise<void> {
    // Dynamic import for WebSocket
    if (!WebSocket) {
      const wsModule = await import("ws").catch(() => null);
      if (!wsModule) {
        throw new Error("WebSocket support not available. Install ws package.");
      }
      WebSocket = wsModule.WebSocket || wsModule.default;
    }

    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(this.options.websocketUrl!);

      this.websocket.onopen = () => {
        logger.info("[MCP] WebSocket connected");
        resolve();
      };

      this.websocket.onerror = (error: any) => {
        logger.error("[MCP] WebSocket error:", error);
        reject(error);
      };

      this.websocket.onclose = () => {
        logger.info("[MCP] WebSocket closed");
        this.connected = false;
      };

      this.websocket.onmessage = this.handleWebSocketMessage.bind(this);
    });
  }

  private setupStdioMessaging(): void {
    if (!this.process) return;

    let buffer = '';

    this.process.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMessage(message);
          } catch (error) {
            logger.warn("[MCP] Failed to parse message:", line);
          }
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      logger.debug("[MCP] STDERR:", data.toString());
    });
  }

  private handleWebSocketMessage(event: any): void {
    try {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    } catch (error) {
      logger.warn("[MCP] Failed to parse WebSocket message:", event.data);
    }
  }

  private handleMessage(message: any): void {
    logger.debug("[MCP] Received message:", message);

    // Handle tool discovery responses (during initialization)
    if (message.result && message.result.tools) {
      for (const tool of message.result.tools) {
        this.tools.set(tool.name, tool);
      }
    }

    // Handle responses (have id)
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error.message || message.error.code));
        } else {
          pending.resolve(message);
        }
        return;
      }
    }

    // Handle notifications (no id)
    if (message.method) {
      this.handleNotification(message);
    }
  }

  private handleNotification(message: MCPMessage): void {
    const handlers = this.notificationHandlers.get(message.method);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.params);
        } catch (error) {
          logger.error(`[MCP] Notification handler error for ${message.method}:`, error);
        }
      }
    }
    
    // Handle tool list changed notifications
    if (message.method === "tools/list_changed") {
      logger.info("[MCP] Tools list changed, refreshing...");
      this.listTools().catch(err => logger.error("[MCP] Failed to refresh tools:", err));
    }

    // Handle resources changed notifications
    if (message.method === "resources/list_changed") {
      logger.info("[MCP] Resources list changed, refreshing...");
      this.listResources().catch(err => logger.error("[MCP] Failed to refresh resources:", err));
    }
  }

  onNotification(method: string, handler: (params: any) => void): void {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, []);
    }
    this.notificationHandlers.get(method)!.push(handler);
  }

  offNotification(method: string, handler: (params: any) => void): void {
    const handlers = this.notificationHandlers.get(method);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async sendNotification(method: string, params: any = {}): Promise<void> {
    if (!this.connected) {
      throw new Error("MCP client is not connected");
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };

    if (this.websocket) {
      this.websocket.send(JSON.stringify(notification));
    } else if (this.process) {
      this.process.stdin?.write(JSON.stringify(notification) + '\n');
    }
  }

  private generateRequestId(): number {
    return this.requestId++;
  }

  private async sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      try {
        if (this.websocket) {
          this.websocket.send(JSON.stringify(request));
        } else if (this.process) {
          this.process.stdin?.write(JSON.stringify(request) + '\n');
        } else {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(new Error("No active connection"));
        }
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.id);
        reject(error);
      }
    });
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error("MCP client is not connected");
    }

    const request = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "tools/list"
    };

    const response = await this.sendRequest(request);
    
    if (response.result?.tools) {
      this.tools.clear();
      for (const tool of response.result.tools) {
        this.tools.set(tool.name, tool);
      }
    }
    
    return Array.from(this.tools.values());
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) {
      throw new Error("MCP client is not connected");
    }

    const request = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "resources/list"
    };

    const response = await this.sendRequest(request);
    
    if (response.result?.resources) {
      this.resources.clear();
      for (const resource of response.result.resources) {
        this.resources.set(resource.uri, resource);
      }
    }
    
    return Array.from(this.resources.values());
  }

  async readResource(uri: string): Promise<any> {
    if (!this.connected) {
      throw new Error("MCP client is not connected");
    }

    const request = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "resources/read",
      params: { uri }
    };

    const response = await this.sendRequest(request);
    return response.result;
  }

  private async initialize(): Promise<void> {
    // Send initialize request
    const initRequest = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "initialize",
      params: {
        protocolVersion: this.protocolVersion,
        capabilities: {
          tools: {},
          resources: {}
        },
        clientInfo: {
          name: "krab",
          version: "0.1.0"
        }
      }
    };

    const initResponse = await this.sendRequest(initRequest);
    
    if (initResponse.result) {
      this.protocolVersion = initResponse.result.protocolVersion || this.protocolVersion;
      this.serverCapabilities = initResponse.result.capabilities || {};
      this.clientInfo = initResponse.result.serverInfo || {};
      logger.info("[MCP] Initialized with server:", this.clientInfo);
    }

    // Discover available tools
    await this.listTools();

    // Discover available resources if supported
    if (this.serverCapabilities?.resources) {
      try {
        await this.listResources();
      } catch (error) {
        logger.debug("[MCP] Resource listing not supported");
      }
    }
  }
}

// Factory function for creating MCP clients
export function createMCPClient(options: MCPClientOptions): MCPClient {
  return new MCPClient(options);
}

// Export for dynamic loading
export default MCPClient;
