// ============================================================
// 🦀 Krab — Gateway Server (Production-Ready)
// OpenAI-Compatible API + WebSocket + SSE Streaming
// ============================================================
import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseUrl } from "url";
import { logger } from "../utils/logger.js";
import { Agent } from "../core/agent.js";
import { loadConfig } from "../core/config.js";
import { ConversationMemory } from "../memory/conversation-enhanced.js";
import { registry } from "../tools/registry.js";
import { ChannelManager } from "../channels/manager.js";
import { presenceTracker } from "../presence/tracker.js";
import { readFileSync, existsSync, statSync, createReadStream } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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
  cors?: {
    allowOrigins?: string[];
    allowMethods?: string[];
    allowHeaders?: string[];
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
  private defaultAgent: Agent;
  private channelManager: ChannelManager;
  private startTime: number = Date.now();

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

    // Initialize one default agent
    this.defaultAgent = new Agent(loadConfig());
    this.channelManager = new ChannelManager(this.defaultAgent);
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

        // Start channels
        this.channelManager.start().catch((err) => {
          logger.error(
            `[Gateway] Failed to start ChannelManager: ${err.message}`,
          );
        });

        resolve();
      });

      this.server.on("error", (error) => {
        logger.error("[Gateway] Server error:", error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    await this.channelManager.stop();
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

  // ── Authentication ─────────────────────────────────────────
  private async authenticateRequest(req: IncomingMessage): Promise<boolean> {
    switch (this.config.auth.mode) {
      case "none":
        return true;

      case "token":
        if (!this.config.auth.token) return false;
        const authHeader = req.headers.authorization;
        return authHeader === `Bearer ${this.config.auth.token}`;

      case "password": {
        const passwordAuthHeader = req.headers.authorization;
        if (!passwordAuthHeader || !passwordAuthHeader.startsWith("Basic "))
          return false;
        const credentials = Buffer.from(passwordAuthHeader.slice(6), "base64")
          .toString()
          .split(":");
        return (
          credentials[0] === "krab" &&
          credentials[1] === this.config.auth.password
        );
      }

      case "trusted-proxy": {
        const userHeader = this.config.auth.trustedProxy?.userHeader;
        if (!userHeader) return false;
        return !!req.headers[userHeader.toLowerCase()];
      }

      default:
        return false;
    }
  }

  // ── Rate Limiting ──────────────────────────────────────────
  private checkRateLimit(clientId: string): boolean {
    if (!this.config.auth.rateLimit) return true;

    const now = Date.now();
    const limit = this.config.auth.rateLimit;

    // Exempt loopback
    if (
      limit.exemptLoopback &&
      (clientId === "127.0.0.1" || clientId === "::1")
    ) {
      return true;
    }

    const entry = this.rateLimitMap.get(clientId);

    if (entry?.lockedUntil && now < entry.lockedUntil) {
      return false;
    }

    if (!entry || now - entry.firstAttempt > limit.windowMs) {
      this.rateLimitMap.set(clientId, { attempts: 1, firstAttempt: now });
      return true;
    }

    entry.attempts++;

    if (entry.attempts > limit.maxAttempts) {
      entry.lockedUntil = now + limit.lockoutMs;
      logger.warn(
        `[Gateway] Rate limit exceeded for ${clientId}, locked for ${limit.lockoutMs}ms`,
      );
      return false;
    }

    return true;
  }

  private getClientId(req: IncomingMessage): string {
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

  // ── CORS ───────────────────────────────────────────────────
  private setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin || "*";
    const allowedOrigins = this.config.cors?.allowOrigins || ["*"];

    // Check if origin is allowed
    const isAllowed =
      allowedOrigins.includes("*") || allowedOrigins.includes(origin as string);

    res.setHeader(
      "Access-Control-Allow-Origin",
      isAllowed ? (origin as string) : "",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      (
        this.config.cors?.allowMethods || ["GET", "POST", "OPTIONS", "DELETE"]
      ).join(", "),
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      (
        this.config.cors?.allowHeaders || [
          "Content-Type",
          "Authorization",
          "X-Session-Id",
          "X-Request-Id",
        ]
      ).join(", "),
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  // ── HTTP Request Router ────────────────────────────────────
  private async handleHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const clientId = this.getClientId(req);

    // CORS headers on all requests
    this.setCorsHeaders(req, res);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limit
    if (!this.checkRateLimit(clientId)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: { message: "Rate limit exceeded", type: "rate_limit_error" },
        }),
      );
      return;
    }

    // Auth (skip for health check)
    const url = parseUrl(req.url || "", true);
    const path = url.pathname || "/";

    if (path !== "/health" && !path.startsWith("/generated-images/") && !(await this.authenticateRequest(req))) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: "Authentication failed",
            type: "authentication_error",
          },
        }),
      );
      return;
    }

    // Security headers
    if (this.config.http?.securityHeaders?.strictTransportSecurity) {
      res.setHeader(
        "Strict-Transport-Security",
        this.config.http.securityHeaders.strictTransportSecurity,
      );
    }

    // Route
    try {
      // Root — Gateway Status
      if (path === "/" || path === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(
          "🦀 Krab Gateway — TUI/CLI mode active. Web Dashboard disabled.",
        );
        return;
      }

      if (path.startsWith("/generated-images/") && req.method === "GET") {
        await this.serveGeneratedAsset(path, res);
        return;
      }

      // Status API
      if (path === "/v1/status" && req.method === "GET") {
        const stats = {
          version: "0.1.0",
          serverTime: new Date().toISOString(),
          uptime: (Date.now() - this.startTime) / 1000,
          memory: process.memoryUsage().rss / 1024 / 1024,
          channels: this.channelManager.getStats(),
          agent: this.defaultAgent.getMemoryStats(),
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(stats));
        return;
      }

      // OpenAI-compatible Chat Completions
      if (path === "/v1/chat/completions" && req.method === "POST") {
        await this.handleChatCompletions(req, res);
      } else if (path === "/v1/models" && req.method === "GET") {
        this.handleListModels(res);
      } else if (path === "/health" && req.method === "GET") {
        this.handleHealthCheck(res);
      } else if (path === "/status" && req.method === "GET") {
        this.handleStatus(res);
      } else if (path === "/ready" && req.method === "GET") {
        this.handleReadyCheck(res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: `Endpoint not found: ${path}`,
              type: "not_found_error",
            },
          }),
        );
      }
    } catch (error) {
      logger.error("[Gateway] HTTP request error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: { message: "Internal server error", type: "internal_error" },
        }),
      );
    }
  }

  private async serveGeneratedAsset(requestPath: string, res: ServerResponse): Promise<void> {
    const relativePath = requestPath.replace(/^\/generated-images\//, "");
    const assetPath = resolve(process.cwd(), "generated-images", relativePath);
    const baseDir = resolve(process.cwd(), "generated-images");

    if (!assetPath.startsWith(baseDir) || !existsSync(assetPath) || statSync(assetPath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Asset not found", type: "not_found" } }));
      return;
    }

    const extension = assetPath.split(".").pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      m4a: "audio/mp4",
      mp4: "video/mp4",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      pdf: "application/pdf",
      json: "application/json",
      txt: "text/plain"
    };

    res.writeHead(200, {
      "Content-Type": contentTypeMap[extension || ""] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600"
    });
    createReadStream(assetPath).pipe(res);
  }

  // ── Chat Completions (OpenAI-Compatible) ──────────────────
  private async handleChatCompletions(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (!this.config.http?.endpoints?.chatCompletions?.enabled) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: "Chat completions not enabled",
            type: "not_found_error",
          },
        }),
      );
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const request = JSON.parse(body);
        const sessionId =
          request.session_id || req.headers["x-session-id"] || "default";
        const requestId = `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Get or create agent
        let agent = this.agents.get(sessionId as string);
        if (!agent) {
          const config = loadConfig();
          agent = new Agent(config);
          this.agents.set(sessionId as string, agent);
        }

        // Extract messages
        const messages = request.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          name: msg.name,
        }));

        const lastMessage = messages[messages.length - 1].content;

        // ── SSE Streaming ────────────────────────────────────
        if (request.stream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Request-Id": requestId,
          });

          // Send initial chunk
          const startChunk = {
            id: requestId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: request.model || "krab",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "" },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(startChunk)}\n\n`);

          // Get full response from agent
          const response = await agent.chat(lastMessage, {
            conversationId: sessionId as string,
            messages: messages.slice(0, -1),
          });

          // Stream it in chunks (simulate streaming for now)
          const chunkSize = 4; // characters per chunk
          for (let i = 0; i < response.length; i += chunkSize) {
            const textChunk = response.slice(i, i + chunkSize);
            const chunk = {
              id: requestId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: request.model || "krab",
              choices: [
                {
                  index: 0,
                  delta: { content: textChunk },
                  finish_reason: null,
                },
              ],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          // Send final chunk
          const endChunk = {
            id: requestId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: request.model || "krab",
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "stop",
              },
            ],
          };
          res.write(`data: ${JSON.stringify(endChunk)}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        } else {
          // ── Non-Streaming Response ────────────────────────
          const response = await agent.chat(lastMessage, {
            conversationId: sessionId as string,
            messages: messages.slice(0, -1),
          });

          const promptTokens = messages.reduce(
            (sum: number, msg: any) => sum + (msg.content?.length || 0),
            0,
          );

          const openaiResponse = {
            id: requestId,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: request.model || "krab",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: response },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: Math.ceil(promptTokens / 4),
              completion_tokens: Math.ceil(response.length / 4),
              total_tokens: Math.ceil((promptTokens + response.length) / 4),
            },
          };

          res.writeHead(200, {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          });
          res.end(JSON.stringify(openaiResponse));
        }
      } catch (error) {
        logger.error("[Gateway] Chat completions error:", error);

        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }
        res.end(
          JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : "Unknown error",
              type: "internal_error",
            },
          }),
        );
      }
    });
  }

  // ── List Models (OpenAI-Compatible) ───────────────────────
  private handleListModels(res: ServerResponse): void {
    const config = loadConfig();
    const primaryModel = config.agents?.defaults?.model?.primary || "krab";

    const models = [
      {
        id: primaryModel,
        object: "model",
        created: Math.floor(this.startTime / 1000),
        owned_by: "krab",
        permission: [],
        root: primaryModel,
        parent: null,
      },
      {
        id: "krab",
        object: "model",
        created: Math.floor(this.startTime / 1000),
        owned_by: "krab",
        permission: [],
        root: "krab",
        parent: null,
      },
    ];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: models }));
  }

  // ── Health / Ready / Status ────────────────────────────────
  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      }),
    );
  }

  private handleReadyCheck(res: ServerResponse): void {
    // Ready if we can load config and have at least one agent ready
    try {
      loadConfig();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ready",
          timestamp: new Date().toISOString(),
        }),
      );
    } catch {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "not_ready",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  private handleStatus(res: ServerResponse): void {
    const stats = this.conversations.getStats();
    const toolNames = registry.getNames();
    const agentStats = Array.from(this.agents.entries()).map(([id]) => ({
      id,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "running",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        conversations: stats,
        agents: agentStats,
        tools: {
          count: toolNames.length,
          list: toolNames,
        },
        websocket: {
          connections: this.wss.clients.size,
        },
      }),
    );
  }

  // ── WebSocket ──────────────────────────────────────────────
  private handleWebSocketConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = this.getClientId(req);

    // Authenticate WebSocket connections
    if (this.config.auth.mode !== "none") {
      const url = parseUrl(req.url || "", true);
      const token = url.query.token as string;
      const authHeader = req.headers.authorization;

      let authenticated = false;

      if (this.config.auth.mode === "token" && this.config.auth.token) {
        // Check via query param or header
        authenticated =
          token === this.config.auth.token ||
          authHeader === `Bearer ${this.config.auth.token}`;
      } else {
        // For password/trusted-proxy, check header
        this.authenticateRequest(req).then((ok) => {
          if (!ok) {
            ws.close(4001, "Authentication failed");
          }
        });
        authenticated = true; // async check above
      }

      if (!authenticated) {
        ws.close(4001, "Authentication failed");
        logger.warn(`[Gateway] WebSocket auth failed for ${clientId}`);
        return;
      }
    }

    logger.info(`[Gateway] WebSocket connection from ${clientId}`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        message: "🦀 Connected to Krab Gateway",
      }),
    );

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "chat":
            await this.handleWebSocketChat(ws, message);
            break;
          case "chat.stream":
            await this.handleWebSocketStreamChat(ws, message);
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;
          case "status":
            ws.send(
              JSON.stringify({
                type: "status",
                connections: this.wss.clients.size,
                agents: this.agents.size,
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
              }),
            );
            break;
          default:
            ws.send(
              JSON.stringify({
                type: "error",
                error: `Unknown message type: ${message.type}`,
              }),
            );
        }
      } catch (error) {
        logger.error("[Gateway] WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Invalid message format",
          }),
        );
      }
    });

    ws.on("close", () => {
      logger.info(`[Gateway] WebSocket disconnected: ${clientId}`);
    });

    ws.on("error", (error) => {
      logger.error(`[Gateway] WebSocket error for ${clientId}:`, error);
    });
  }

  private async handleWebSocketChat(
    ws: WebSocket,
    message: any,
  ): Promise<void> {
    try {
      const sessionId = message.sessionId || "ws_default";
      let agent = this.agents.get(sessionId);

      if (!agent) {
        const config = loadConfig();
        agent = new Agent(config);
        this.agents.set(sessionId, agent);
      }

      const response = await agent.chat(message.content, {
        conversationId: sessionId,
      });

      ws.send(
        JSON.stringify({
          type: "chat.response",
          content: response,
          sessionId,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now(),
        }),
      );
    }
  }

  // ── WebSocket Streaming ────────────────────────────────────
  private async handleWebSocketStreamChat(
    ws: WebSocket,
    message: any,
  ): Promise<void> {
    try {
      const sessionId = message.sessionId || "ws_default";
      let agent = this.agents.get(sessionId);

      if (!agent) {
        const config = loadConfig();
        agent = new Agent(config);
        this.agents.set(sessionId, agent);
      }

      // Send start
      ws.send(
        JSON.stringify({
          type: "chat.stream.start",
          sessionId,
          timestamp: Date.now(),
        }),
      );

      // Get full response
      const response = await agent.chat(message.content, {
        conversationId: sessionId,
      });

      // Stream in chunks
      const chunkSize = 8;
      for (let i = 0; i < response.length; i += chunkSize) {
        const textChunk = response.slice(i, i + chunkSize);
        ws.send(
          JSON.stringify({
            type: "chat.stream.delta",
            content: textChunk,
            sessionId,
          }),
        );
      }

      // Send end
      ws.send(
        JSON.stringify({
          type: "chat.stream.end",
          sessionId,
          timestamp: Date.now(),
          fullContent: response,
        }),
      );
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now(),
        }),
      );
    }
  }

  // ── Control Methods ────────────────────────────────────────
  getStats(): {
    connections: number;
    conversations: any;
    agents: number;
    uptime: number;
    tools: number;
  } {
    return {
      connections: this.wss.clients.size,
      conversations: this.conversations.getStats(),
      agents: this.agents.size,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      tools: registry.getNames().length,
    };
  }

  reloadConfig(newConfig: GatewayConfig): void {
    this.config = newConfig;
    logger.info("[Gateway] Configuration reloaded");
  }
}
