// ============================================================
// 🦀 Krab — Cloud Client SDK
// ============================================================
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface CloudConfig {
  apiUrl?: string;
  websocketUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ChatMessage {
  id?: string;
  message: string;
  sessionId?: string;
  context?: any;
  timestamp?: string;
}

export interface ChatResponse {
  messageId: string;
  response: string;
  timestamp: string;
  sessionId: string;
}

export interface ToolExecution {
  id?: string;
  tool: string;
  parameters: any;
  sessionId?: string;
  timestamp?: string;
}

export interface ToolResult {
  executionId: string;
  tool: string;
  result: any;
  timestamp: string;
  sessionId: string;
}

export class KrabCloudClient extends EventEmitter {
  private config: Required<CloudConfig>;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private requestId = 0;

  constructor(config: CloudConfig = {}) {
    super();

    this.config = {
      apiUrl: config.apiUrl || 'https://api.krab.ai',
      websocketUrl: config.websocketUrl || 'wss://api.krab.ai',
      apiKey: config.apiKey || process.env.KRAB_API_KEY || '',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 5,
      retryDelay: config.retryDelay || 1000
    };
  }

  // Connection management
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.config.websocketUrl}?apiKey=${this.config.apiKey}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse WebSocket message: ${error}`));
          }
        });

        this.ws.on('error', (error) => {
          this.emit('error', error);
          this.handleReconnect();
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.emit('disconnected');
          this.handleReconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.retryAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.retryDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('error', error);
      });
    }, delay);
  }

  private handleMessage(message: any): void {
    switch (message.type || message.event) {
      case 'welcome':
        this.emit('welcome', message);
        break;
      case 'chat-response':
        this.emit('chatResponse', message);
        break;
      case 'tool-result':
        this.emit('toolResult', message);
        break;
      case 'error':
        this.emit('error', new Error(message.message || 'WebSocket error'));
        break;
      case 'heartbeat-response':
        this.emit('heartbeat', message);
        break;
      default:
        this.emit('message', message);
    }
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  // Chat methods
  async sendChatMessage(message: ChatMessage): Promise<ChatResponse> {
    const payload = {
      type: 'chat-message',
      id: message.id || `chat-${Date.now()}`,
      message: message.message,
      sessionId: message.sessionId || 'default',
      context: message.context,
      timestamp: message.timestamp || new Date().toISOString()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Chat message timeout'));
        }, this.config.timeout);

        const handler = (response: ChatResponse) => {
          if (response.messageId === payload.id) {
            clearTimeout(timeout);
            this.removeListener('chatResponse', handler);
            resolve(response);
          }
        };

        this.on('chatResponse', handler);
      });
    } else {
      // Fallback to HTTP API
      return this.sendChatMessageHTTP(message);
    }
  }

  private async sendChatMessageHTTP(message: ChatMessage): Promise<ChatResponse> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        message: message.message,
        sessionId: message.sessionId,
        context: message.context
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return this.parseJsonResponse<ChatResponse>(response);
  }

  // Tool execution methods
  async executeTool(execution: ToolExecution): Promise<ToolResult> {
    const payload = {
      type: 'tool-execute',
      id: execution.id || `tool-${Date.now()}`,
      tool: execution.tool,
      parameters: execution.parameters,
      sessionId: execution.sessionId || 'default',
      timestamp: execution.timestamp || new Date().toISOString()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tool execution timeout'));
        }, this.config.timeout);

        const handler = (result: ToolResult) => {
          if (result.executionId === payload.id) {
            clearTimeout(timeout);
            this.removeListener('toolResult', handler);
            resolve(result);
          }
        };

        this.on('toolResult', handler);
      });
    } else {
      // Fallback to HTTP API
      return this.executeToolHTTP(execution);
    }
  }

  private async executeToolHTTP(execution: ToolExecution): Promise<ToolResult> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        tool: execution.tool,
        parameters: execution.parameters,
        sessionId: execution.sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return this.parseJsonResponse<ToolResult>(response);
  }

  // Health check
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.config.apiUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  // Status check
  async getStatus(): Promise<any> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/status`, {
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }
    return response.json();
  }

  // Heartbeat
  sendHeartbeat(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Configuration
  updateConfig(config: Partial<CloudConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CloudConfig {
    return { ...this.config };
  }
}

// ── Browser-compatible version (for web clients) ─────────────
export class KrabCloudBrowserClient extends EventEmitter {
  private config: Required<CloudConfig>;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private requestId = 0;

  constructor(config: CloudConfig = {}) {
    super();

    this.config = {
      apiUrl: config.apiUrl || 'https://api.krab.ai',
      websocketUrl: config.websocketUrl || 'wss://api.krab.ai',
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 5,
      retryDelay: config.retryDelay || 1000
    };
  }

  // Similar implementation but for browser WebSocket
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.config.websocketUrl}?apiKey=${this.config.apiKey}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const rawData =
              typeof event.data === 'string' ? event.data : String(event.data);
            const message = JSON.parse(rawData);
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse WebSocket message: ${error}`));
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          this.handleReconnect();
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        };

        this.ws.onclose = () => {
          this.emit('disconnected');
          this.handleReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.emit('disconnected');
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.retryAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.retryDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('error', error);
      });
    }, delay);
  }

  private handleMessage(message: any): void {
    switch (message.type || message.event) {
      case 'welcome':
        this.emit('welcome', message);
        break;
      case 'chat-response':
        this.emit('chatResponse', message);
        break;
      case 'tool-result':
        this.emit('toolResult', message);
        break;
      case 'error':
        this.emit('error', new Error(message.message || 'WebSocket error'));
        break;
      case 'heartbeat-response':
        this.emit('heartbeat', message);
        break;
      default:
        this.emit('message', message);
    }
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  // HTTP-only methods for browser (WebSocket is handled above)
  async sendChatMessageHTTP(message: ChatMessage): Promise<ChatResponse> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        message: message.message,
        sessionId: message.sessionId,
        context: message.context
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return this.parseJsonResponse<ChatResponse>(response);
  }

  async executeToolHTTP(execution: ToolExecution): Promise<ToolResult> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        tool: execution.tool,
        parameters: execution.parameters,
        sessionId: execution.sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return this.parseJsonResponse<ToolResult>(response);
  }

  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.config.apiUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  async getStatus(): Promise<any> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/status`, {
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }
    return response.json();
  }
}

// Export factory functions
export function createKrabCloudClient(config?: CloudConfig): KrabCloudClient {
  return new KrabCloudClient(config);
}

export function createKrabCloudBrowserClient(config?: CloudConfig): KrabCloudBrowserClient {
  return new KrabCloudBrowserClient(config);
}

// Default export
export default KrabCloudClient;
