// ============================================================
// 🦀 Krab SDK — Software Development Kit
// ============================================================
import { KrabCloudClient, CloudConfig } from '../cloud/client.js';
import { logger } from '../utils/logger.js';

export interface KrabSDKConfig extends CloudConfig {
  autoConnect?: boolean;
  retryOnFailure?: boolean;
  timeout?: number;
  maxRetries?: number;
  enableLogging?: boolean;
  customLogger?: (level: string, message: string, meta?: any) => void;
}

export interface AgentConfig {
  name: string;
  description?: string;
  capabilities?: string[];
  tools?: string[];
  personality?: string;
  memory?: boolean;
  voice?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ConversationOptions {
  agentId?: string;
  sessionId?: string;
  context?: any;
  stream?: boolean;
  timeout?: number;
}

export interface ToolExecutionOptions {
  tool: string;
  parameters: any;
  agentId?: string;
  sessionId?: string;
  timeout?: number;
}

export interface SDKResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    requestId: string;
    timestamp: Date;
    duration: number;
    agentId?: string;
    sessionId?: string;
  };
}

export class KrabSDK {
  private client: KrabCloudClient;
  private config: KrabSDKConfig;
  private agents: Map<string, AgentConfig> = new Map();
  private activeConversations: Map<string, any> = new Map();

  constructor(config: KrabSDKConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl ?? 'https://api.krab.ai',
      websocketUrl: config.websocketUrl ?? 'wss://api.krab.ai',
      apiKey: config.apiKey ?? process.env.KRAB_API_KEY ?? '',
      retryAttempts: config.retryAttempts ?? 5,
      retryDelay: config.retryDelay ?? 1000,
      autoConnect: config.autoConnect ?? true,
      retryOnFailure: config.retryOnFailure ?? true,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enableLogging: config.enableLogging ?? false,
      customLogger: config.customLogger,
    };

    this.client = new KrabCloudClient(this.config);

    if (this.config.enableLogging) {
      this.setupLogging();
    }

    if (this.config.autoConnect) {
      this.connect().catch(error => {
        this.log('error', 'Auto-connect failed', { error: error.message });
      });
    }
  }

  private setupLogging(): void {
    if (this.config.customLogger) {
      // Use custom logger
      return;
    }

    // Default logging
    this.client.on('connected', () => this.log('info', 'Connected to Krab'));
    this.client.on('disconnected', () => this.log('info', 'Disconnected from Krab'));
    this.client.on('error', (error) => this.log('error', 'Connection error', { error }));
  }

  private log(level: string, message: string, meta?: any): void {
    if (!this.config.enableLogging) return;

    if (this.config.customLogger) {
      this.config.customLogger(level, message, meta);
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    switch (level) {
      case 'error':
        console.error(logMessage, meta || '');
        break;
      case 'warn':
        console.warn(logMessage, meta || '');
        break;
      case 'info':
        console.info(logMessage, meta || '');
        break;
      case 'debug':
        console.debug(logMessage, meta || '');
        break;
      default:
        console.log(logMessage, meta || '');
    }
  }

  // Connection management
  async connect(): Promise<SDKResponse<boolean>> {
    const startTime = Date.now();
    const requestId = `connect-${Date.now()}`;

    try {
      await this.client.connect();
      const duration = Date.now() - startTime;

      return {
        success: true,
        data: true,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', 'Connection failed', { error: (error as Error).message });

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration
        }
      };
    }
  }

  disconnect(): void {
    this.client.disconnect();
    this.log('info', 'Disconnected from Krab');
  }

  isConnected(): boolean {
    return this.client.listenerCount('connected') >= 0 && this.client.isConnected();
  }

  // Agent management
  createAgent(config: AgentConfig): string {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.agents.set(agentId, config);
    this.log('info', `Agent created: ${agentId}`, { name: config.name });
    return agentId;
  }

  updateAgent(agentId: string, updates: Partial<AgentConfig>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.agents.set(agentId, { ...agent, ...updates });
    this.log('info', `Agent updated: ${agentId}`, updates);
    return true;
  }

  deleteAgent(agentId: string): boolean {
    const deleted = this.agents.delete(agentId);
    if (deleted) {
      this.log('info', `Agent deleted: ${agentId}`);
    }
    return deleted;
  }

  getAgent(agentId: string): AgentConfig | null {
    return this.agents.get(agentId) || null;
  }

  listAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  // Conversation management
  async startConversation(options: ConversationOptions = {}): Promise<SDKResponse<string>> {
    const startTime = Date.now();
    const requestId = `conv-${Date.now()}`;
    const sessionId = options.sessionId || `session-${Date.now()}`;

    try {
      // Validate agent if specified
      if (options.agentId && !this.agents.has(options.agentId)) {
        throw new Error(`Agent not found: ${options.agentId}`);
      }

      this.activeConversations.set(sessionId, {
        agentId: options.agentId,
        startedAt: new Date(),
        messageCount: 0
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: sessionId,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          sessionId
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          sessionId
        }
      };
    }
  }

  async sendMessage(message: string, options: ConversationOptions = {}): Promise<SDKResponse<string>> {
    const startTime = Date.now();
    const requestId = `msg-${Date.now()}`;
    const sessionId = options.sessionId || 'default';

    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to Krab. Call connect() first.');
      }

      const chatMessage = {
        message,
        sessionId,
        context: options.context,
        timestamp: new Date().toISOString()
      };

      const response = await this.client.sendChatMessage(chatMessage);

      // Update conversation tracking
      const conversation = this.activeConversations.get(sessionId);
      if (conversation) {
        conversation.messageCount++;
        conversation.lastActivity = new Date();
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: response.response,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          agentId: options.agentId,
          sessionId
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', 'Message send failed', { error: (error as Error).message });

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          agentId: options.agentId,
          sessionId
        }
      };
    }
  }

  async executeTool(options: ToolExecutionOptions): Promise<SDKResponse<any>> {
    const startTime = Date.now();
    const requestId = `tool-${Date.now()}`;
    const sessionId = options.sessionId || 'default';

    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to Krab. Call connect() first.');
      }

      const toolExecution = {
        tool: options.tool,
        parameters: options.parameters,
        sessionId,
        timestamp: new Date().toISOString()
      };

      const result = await this.client.executeTool(toolExecution);
      const duration = Date.now() - startTime;

      return {
        success: true,
        data: result.result,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          agentId: options.agentId,
          sessionId
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', 'Tool execution failed', { error: (error as Error).message });

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          agentId: options.agentId,
          sessionId
        }
      };
    }
  }

  async endConversation(sessionId: string): Promise<SDKResponse<boolean>> {
    const startTime = Date.now();
    const requestId = `end-${Date.now()}`;

    try {
      const conversation = this.activeConversations.get(sessionId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${sessionId}`);
      }

      // Clean up conversation data
      this.activeConversations.delete(sessionId);
      const duration = Date.now() - startTime;

      return {
        success: true,
        data: true,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          sessionId
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          sessionId
        }
      };
    }
  }

  // Utility methods
  getActiveConversations(): Array<{ sessionId: string; agentId?: string; messageCount: number; startedAt: Date; lastActivity?: Date }> {
    return Array.from(this.activeConversations.entries()).map(([sessionId, data]) => ({
      sessionId,
      agentId: data.agentId,
      messageCount: data.messageCount,
      startedAt: data.startedAt,
      lastActivity: data.lastActivity
    }));
  }

  getConnectionStatus(): {
    connected: boolean;
    url?: string;
    lastHeartbeat?: Date;
  } {
    return {
      connected: this.isConnected(),
      url: this.config.apiUrl,
      lastHeartbeat: undefined // TODO: Track heartbeat
    };
  }

  // Event handling
  on(event: string, listener: (...args: any[]) => void): void {
    this.client.on(event, listener);
  }

  off(event: string, listener?: (...args: any[]) => void): void {
    if (listener) {
      this.client.removeListener(event, listener);
    } else {
      this.client.removeAllListeners(event);
    }
  }

  // Configuration
  updateConfig(config: Partial<KrabSDKConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('info', 'SDK configuration updated', config);
  }

  getConfig(): KrabSDKConfig {
    return { ...this.config };
  }
}

// ── Browser-compatible SDK (for web applications) ─────────────
export class KrabSDKBrowser extends KrabSDK {
  constructor(config: KrabSDKConfig = {}) {
    // Use browser-compatible client
    super(config);
  }
}

// Factory functions
export function createKrabSDK(config?: KrabSDKConfig): KrabSDK {
  return new KrabSDK(config);
}

export function createKrabSDKBrowser(config?: KrabSDKConfig): KrabSDKBrowser {
  return new KrabSDKBrowser(config);
}

// Default export
export default KrabSDK;
