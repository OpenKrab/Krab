// ============================================================
// 🦀 Krab — Gateway Server (OpenClaw-inspired)
// ============================================================
import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseUrl } from "url";
import { logger } from "../utils/logger.js";
import { Agent } from "../core/agent.js";
import { loadConfig } from "../core/config.js";
import { ConversationMemory } from "../memory/conversation-enhanced.js";

interface GatewayConfig {
  port: number;
  bind: "loopback" | "lan" | "tailnet" | "custom";
  auth: {
    mode: "none" | "token" | "password" | "trusted-proxy";
    token?: string;
    password?: string;
    trustedProxy?: {
      userHeader: string;
    };
    allowTailscale?: boolean;
    rateLimit?: {
      maxAttempts: number;
      windowMs: number;
      lockoutMs: number;
      exemptLoopback: boolean;
    };
  };
  http?: {
    endpoints?: {
      chatCompletions?: {
        enabled: boolean;
      };
      responses?: {
        enabled: boolean;
        maxUrlParts?: number;
        files?: {
          urlAllowlist?: string[];
        };
        images?: {
          urlAllowlist?: string[];
        };
      };
    };
    securityHeaders?: {
      strictTransportSecurity?: string;
    };
  };
}

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

export class GatewayServer {
  private server: Server;
  private wss: WebSocketServer;
  private config: GatewayConfig;
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private conversations: ConversationMemory;
  private agents: Map<string, Agent> = new Map();

  constructor(config: GatewayConfig, workspace: string) {
    this.config = config;
    this.conversations = new ConversationMemory(workspace);
    
    this.server = createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on("connection", (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = this.config.port;
      const bind = this.getBindAddress();

      this.server.listen(port, bind, () => {
        logger.info(`[Gateway] Server listening on ${bind}:${port}`);
        logger.info(`[Gateway] Mode: ${this.config.auth.mode}`);
        logger.info(`[Gateway] WebSocket: ws://${bind}:${port}`);
        logger.info(`[Gateway] HTTP APIs: http://${bind}:${port}`);
        resolve();
      });

      this.server.on("error", (error) => {
        logger.error("[Gateway] Server error:", error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => {
        logger.info("[Gateway] Server stopped");
        resolve();
      });
    });
  }

  private getBindAddress(): string {
    switch (this.config.bind) {
      case "loopback":
        return "127.0.0.1";
      case "lan":
        return "0.0.0.0";
      case "tailnet":
        return process.env.TAILSCALE_IP || "127.0.0.1";
      case "custom":
        return process.env.KRAB_BIND_ADDRESS || "127.0.0.1";
      default:
        return "127.0.0.1";
    }
  }

  private async authenticateRequest(req: IncomingMessage): Promise<boolean> {
    switch (this.config.auth.mode) {
      case "none":
        return true;

      case "token":
        if (!this.config.auth.token) return false;
        const authHeader = req.headers.authorization;
        return authHeader === `Bearer ${this.config.auth.token}`;

      case "password":
        // For password auth, check in request body or headers
        const passwordAuthHeader = req.headers.authorization;
        if (!passwordAuthHeader || !passwordAuthHeader.startsWith("Basic ")) return false;
        const credentials = Buffer.from(passwordAuthHeader.slice(6), "base64").toString().split(":");
        return credentials[0] === "krab" && credentials[1] === this.config.auth.password;

      case "trusted-proxy":
        // Check trusted proxy header
        const userHeader = this.config.auth.trustedProxy?.userHeader;
        if (!userHeader) return false;
        return !!req.headers[userHeader.toLowerCase()];

      default:
        return false;
    }
  }

  private checkRateLimit(clientId: string): boolean {
    if (!this.config.auth.rateLimit) return true;

    const now = Date.now();
    const limit = this.config.auth.rateLimit;
    const entry = this.rateLimitMap.get(clientId);

    // Check if currently locked out
    if (entry?.lockedUntil && now < entry.lockedUntil) {
      return false;
    }

    if (!entry || now - entry.firstAttempt > limit.windowMs) {
      // Reset window
      this.rateLimitMap.set(clientId, {
        attempts: 1,
        firstAttempt: now
      });
      return true;
    }

    entry.attempts++;

    if (entry.attempts > limit.maxAttempts) {
      entry.lockedUntil = now + limit.lockoutMs;
      logger.warn(`[Gateway] Rate limit exceeded for ${clientId}, locked for ${limit.lockoutMs}ms`);
      return false;
    }

    return true;
  }

  private getClientId(req: IncomingMessage): string {
    // Use IP address as client identifier
    const forwarded = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];

    if (forwarded && typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    if (realIp && typeof realIp === "string") {
      return realIp;
    }
    return req.socket.remoteAddress || "unknown";
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const clientId = this.getClientId(req);

    // Check rate limit
    if (!this.checkRateLimit(clientId)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: {
          message: "Rate limit exceeded",
          type: "rate_limit_error"
        }
      }));
      return;
    }

    // Authenticate
    if (!await this.authenticateRequest(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: {
          message: "Authentication failed",
          type: "authentication_error"
        }
      }));
      return;
    }

    // Set security headers
    if (this.config.http?.securityHeaders?.strictTransportSecurity) {
      res.setHeader("Strict-Transport-Security", this.config.http.securityHeaders.strictTransportSecurity);
    }

    // Route requests
    const url = parseUrl(req.url || "", true);
    const path = url.pathname || "/";

    try {
      if (path === "/v1/chat/completions" && req.method === "POST") {
        await this.handleChatCompletions(req, res);
      } else if (path === "/health" && req.method === "GET") {
        this.handleHealthCheck(res);
      } else if (path === "/status" && req.method === "GET") {
        this.handleStatus(res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: {
            message: "Endpoint not found",
            type: "not_found_error"
          }
        }));
      }
    } catch (error) {
      logger.error("[Gateway] HTTP request error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: {
          message: "Internal server error",
          type: "internal_error"
        }
      }));
    }
  }

  private async handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.config.http?.endpoints?.chatCompletions?.enabled) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Chat completions not enabled", type: "not_found_error" } }));
      return;
    }

    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const request = JSON.parse(body);

        // Create or get agent
        const sessionId = request.session_id || "default";
        let agent = this.agents.get(sessionId);

        if (!agent) {
          const config = loadConfig();
          agent = new Agent(config);
          this.agents.set(sessionId, agent);
        }

        // Convert OpenAI format to our message format
        const messages = request.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          name: msg.name
        }));

        // Handle streaming if requested
        if (request.stream) {
          res.writeHead(200, {
            "Content-Type": "text/plain",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          });

          // Streaming not implemented yet
          res.end();

        } else {
          // Non-streaming response
          const response = await agent.chat(messages[messages.length - 1].content, {
            conversationId: sessionId,
            messages: messages.slice(0, -1)
          });

          const openaiResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: request.model || "krab",
            choices: [{
              index: 0,
              message: {
                role: "assistant",
                content: response
              },
              finish_reason: "stop"
            }],
            usage: {
              prompt_tokens: messages.reduce((sum: number, msg: any) => sum + msg.content.length, 0),
              completion_tokens: response.length,
              total_tokens: messages.reduce((sum: number, msg: any) => sum + msg.content.length, 0) + response.length
            }
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(openaiResponse));
        }

      } catch (error) {
        logger.error("[Gateway] Chat completions error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            type: "internal_error"
          }
        }));
      }
    });
  }

  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  }

  private handleStatus(res: ServerResponse): void {
    const stats = this.conversations.getStats();
    const agentStats = Array.from(this.agents.entries()).map(([id, agent]) => ({
      id,
      // Add agent-specific stats if available
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "running",
      timestamp: new Date().toISOString(),
      conversations: stats,
      agents: agentStats,
      websocket: {
        connections: this.wss.clients.size
      }
    }));
  }

  private handleWebSocketConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = this.getClientId(req);
    logger.info(`[Gateway] WebSocket connection from ${clientId}`);

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle WebSocket messages
        switch (message.type) {
          case "chat":
            await this.handleWebSocketChat(ws, message);
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;
          default:
            ws.send(JSON.stringify({
              type: "error",
              error: "Unknown message type"
            }));
        }

      } catch (error) {
        logger.error("[Gateway] WebSocket message error:", error);
        ws.send(JSON.stringify({
          type: "error",
          error: "Invalid message format"
        }));
      }
    });

    ws.on("close", () => {
      logger.info(`[Gateway] WebSocket connection closed for ${clientId}`);
    });

    ws.on("error", (error) => {
      logger.error(`[Gateway] WebSocket error for ${clientId}:`, error);
    });
  }

  private async handleWebSocketChat(ws: WebSocket, message: any): Promise<void> {
    try {
      const sessionId = message.sessionId || "ws_default";
      let agent = this.agents.get(sessionId);

      if (!agent) {
        const config = loadConfig();
        agent = new Agent(config);
        this.agents.set(sessionId, agent);
      }

      const response = await agent.chat(message.content, {
        conversationId: sessionId
      });

      ws.send(JSON.stringify({
        type: "chat_response",
        content: response,
        sessionId,
        timestamp: Date.now()
      }));

    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now()
      }));
    }
  }

  // Control methods
  getStats(): {
    connections: number;
    conversations: any;
    agents: number;
    uptime: number;
  } {
    return {
      connections: this.wss.clients.size,
      conversations: this.conversations.getStats(),
      agents: this.agents.size,
      uptime: process.uptime()
    };
  }

  reloadConfig(newConfig: GatewayConfig): void {
    this.config = newConfig;
    logger.info("[Gateway] Configuration reloaded");
  }
}
