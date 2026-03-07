// ============================================================
// 🦀 Krab — Webhook Server (OpenClaw-inspired)
// ============================================================
import { logger } from "../utils/logger.js";
import { channelRegistry } from "../channels/registry.js";
import type { ChannelConfig } from "../channels/base.js";
import { controlPanel } from "../control-panel/index.js";

// Express types (will be available if express is installed)
type Request = any;
type Response = any;
type NextFunction = any;

// Dynamic imports for optional dependencies
let express: any = null;
let cors: any = null;
let rateLimit: any = null;

// ── Webhook Server Types ──────────────────────────────────────
export interface WebhookConfig {
  port: number;
  bind: "loopback" | "lan" | "tailnet" | "custom";
  host?: string;
  ssl?: {
    enabled: boolean;
    keyPath?: string;
    certPath?: string;
  };
  cors?: {
    enabled: boolean;
    origins?: string[];
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

// ── Webhook Server Implementation ────────────────────────────────
export class WebhookServer {
  private app: any = null;
  private server: any = null;
  private isServerRunning = false;
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of dependencies
      const expressModule = await import("express").catch(() => null);
      if (!expressModule) {
        throw new Error("Express not installed. Run: npm install express");
      }
      express = expressModule.default || expressModule;

      const corsModule = await import("cors").catch(() => null);
      cors = corsModule?.default;

      const rateLimitModule = await import("express-rate-limit").catch(() => null);
      rateLimit = rateLimitModule?.default;

      this.app = express();
      this.setupMiddleware();
      this.setupRoutes();
      
      logger.info("[Webhook] Dependencies loaded successfully");
    } catch (error) {
      logger.error("[Webhook] Failed to initialize dependencies:", error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    if (!this.app) return;

    // JSON body parser with size limits
    this.app.use(express.json({ 
      limit: "10mb",
      strict: true
    }));

    // Raw body parser for signature verification
    this.app.use(express.raw({
      type: "application/json",
      limit: "10mb"
    }));

    // URL-encoded parser
    this.app.use(express.urlencoded({ 
      extended: true,
      limit: "10mb"
    }));

    // CORS setup
    if (this.config.cors?.enabled && cors) {
      this.app.use(cors({
        origin: this.config.cors.origins || ["*"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Line-Signature"]
      }));
    }

    // Rate limiting
    if (this.config.rateLimit && rateLimit) {
      this.app.use(rateLimit({
        windowMs: this.config.rateLimit.windowMs,
        max: this.config.rateLimit.maxRequests,
        message: "Too many requests from this IP",
        standardHeaders: true,
        legacyHeaders: false,
      }));
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.debug(`[Webhook] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  private setupRoutes(): void {
    if (!this.app) return;

    // Health check endpoint
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        channels: channelRegistry.getStatus().totalChannels
      });
    });

    // Ready check endpoint
    this.app.get("/ready", (req: Request, res: Response) => {
      const status = channelRegistry.getStatus();
      res.json({
        status: status.initialized ? "ready" : "not-ready",
        channels: status.totalChannels
      });
    });

    // Telegram webhook
    this.app.post("/telegram/webhook", async (req: Request, res: Response) => {
      try {
        const telegramChannel = channelRegistry.getChannel("telegram");
        if (telegramChannel && typeof telegramChannel.handleWebhook === "function") {
          await telegramChannel.handleWebhook(req, res);
        } else {
          res.status(404).send("Telegram channel not available");
        }
      } catch (error) {
        logger.error("[Webhook] Telegram webhook error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // LINE webhook
    this.app.post("/line/webhook", async (req: Request, res: Response) => {
      try {
        const lineChannel = channelRegistry.getChannel("line");
        if (lineChannel && typeof lineChannel.handleWebhook === "function") {
          await lineChannel.handleWebhook(req, res);
        } else {
          res.status(404).send("LINE channel not available");
        }
      } catch (error) {
        logger.error("[Webhook] LINE webhook error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Discord Interactions webhook (for buttons, select menus, modals)
    this.app.post("/discord/interactions", async (req: Request, res: Response) => {
      try {
        const discordChannel = channelRegistry.getChannel("discord");
        if (discordChannel && typeof discordChannel.handleWebhook === "function") {
          await discordChannel.handleWebhook(req, res);
        } else {
          res.status(404).send("Discord channel not available");
        }
      } catch (error) {
        logger.error("[Webhook] Discord interactions webhook error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Discord webhook (alternative to Gateway)
    this.app.post("/discord/webhook", async (req: Request, res: Response) => {
      try {
        const discordChannel = channelRegistry.getChannel("discord");
        if (discordChannel && typeof discordChannel.handleWebhook === "function") {
          await discordChannel.handleWebhook(req, res);
        } else {
          res.status(404).send("Discord channel not available");
        }
      } catch (error) {
        logger.error("[Webhook] Discord webhook error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // WhatsApp Business API webhook
    this.app.post("/whatsapp/webhook", async (req: Request, res: Response) => {
      try {
        const whatsappChannel = channelRegistry.getChannel("whatsapp");
        if (whatsappChannel && typeof whatsappChannel.handleWebhook === "function") {
          await whatsappChannel.handleWebhook(req, res);
        } else {
          res.status(404).send("WhatsApp channel not available");
        }
      } catch (error) {
        logger.error("[Webhook] WhatsApp webhook error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Generic webhook handler for future channels
    this.app.post("/:channel/webhook", async (req: Request, res: Response) => {
      try {
        const channelName = req.params.channel;
        const channel = channelRegistry.getChannel(channelName);
        
        if (channel && typeof channel.handleWebhook === "function") {
          await channel.handleWebhook(req, res);
        } else {
          res.status(404).send(`Channel ${channelName} not available`);
        }
      } catch (error) {
        logger.error(`[Webhook] ${req.params.channel} webhook error:`, error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Channel status endpoint
    this.app.get("/channels/status", (req: Request, res: Response) => {
      const status = channelRegistry.getStatus();
      res.json(status);
    });

    // Test channel endpoint
    this.app.post("/channels/:channel/test", async (req: Request, res: Response) => {
      try {
        const channelName = req.params.channel;
        const success = await channelRegistry.testChannel(channelName);
        
        res.json({
          channel: channelName,
          success,
          message: success ? "Test successful" : "Test failed"
        });
      } catch (error) {
        logger.error(`[Webhook] Channel test error:`, error);
        res.status(500).send("Test failed");
      }
    });

    // Control UI endpoints
    this.app.get("/control", (req: Request, res: Response) => {
      res.send(controlPanel.getMainPage());
    });

    // Control Panel API routes
    const apiRoutes = controlPanel.getApiRoutes();
    Object.entries(apiRoutes).forEach(([path, handler]) => {
      this.app.get(path, handler);
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: "Not Found",
        path: req.path,
        method: req.method
      });
    });

    // Error handler
    this.app.use((error: any, req: Request, res: Response, next: NextFunction) => {
      logger.error("[Webhook] Unhandled error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    });
  }

  async start(): Promise<void> {
    if (this.isServerRunning) {
      logger.warn("[Webhook] Server already running");
      return;
    }

    if (!this.app) {
      await this.initialize();
    }

    try {
      const host = this.getHost();
      const port = this.config.port;

      if (this.config.ssl?.enabled) {
        // HTTPS server
        const fs = await import("fs");
        const https = await import("https");
        
        const options = {
          key: fs.readFileSync(this.config.ssl.keyPath!),
          cert: fs.readFileSync(this.config.ssl.certPath!)
        };

        this.server = https.createServer(options, this.app);
      } else {
        // HTTP server
        const { createServer } = await import("http");
        this.server = createServer(this.app);
      }

      await new Promise<void>((resolve, reject) => {
        this.server.listen(port, host, () => {
          this.isServerRunning = true;
          const protocol = this.config.ssl?.enabled ? "https" : "http";
          const url = `${protocol}://${host}:${port}`;
          
          logger.info(`[Webhook] Server started at ${url}`);
          logger.info(`[Webhook] Health check: ${url}/health`);
          logger.info(`[Webhook] Control UI: ${url}/control`);
          
          resolve();
        });

        this.server.on("error", (error: any) => {
          if (error.code === "EADDRINUSE") {
            logger.error(`[Webhook] Port ${port} is already in use`);
          } else {
            logger.error("[Webhook] Server error:", error);
          }
          reject(error);
        });
      });

    } catch (error) {
      logger.error("[Webhook] Failed to start server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isServerRunning || !this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.isServerRunning = false;
        logger.info("[Webhook] Server stopped");
        resolve();
      });
    });
  }

  private getHost(): string {
    switch (this.config.bind) {
      case "loopback":
        return "127.0.0.1";
      case "lan":
        return "0.0.0.0";
      case "tailnet":
        return "100.100.100.100";
      case "custom":
        return this.config.host || "127.0.0.1";
      default:
        return "127.0.0.1";
    }
  }

  private getControlUI(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>🦀 Krab Channel Control</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .channel { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { display: flex; align-items: center; margin-bottom: 10px; }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .status.online { background: #10b981; }
        .status.offline { background: #ef4444; }
        .actions { margin-top: 15px; }
        .btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-right: 10px; }
        .btn:hover { background: #2563eb; }
        .btn.danger { background: #ef4444; }
        .btn.danger:hover { background: #dc2626; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦀 Krab Channel Control Panel</h1>
            <p>Manage your messaging channels</p>
        </div>
        <div id="channels">
            <p>Loading channel status...</p>
        </div>
    </div>

    <script>
        async function loadChannels() {
            try {
                const response = await fetch('/channels/status');
                const data = await response.json();
                
                const channelsDiv = document.getElementById('channels');
                channelsDiv.innerHTML = '';
                
                Object.entries(data.channels).forEach(([name, channel]) => {
                    const channelDiv = document.createElement('div');
                    channelDiv.className = 'channel';
                    channelDiv.innerHTML = \`
                        <h3>\${name}</h3>
                        <div class="status">
                            <div class="status-dot \${channel.configured ? 'online' : 'offline'}"></div>
                            <span>\${channel.configured ? 'Configured' : 'Not Configured'}</span>
                        </div>
                        <div class="actions">
                            <button class="btn" onclick="testChannel('\${name}')">Test</button>
                            <button class="btn danger" onclick="removeChannel('\${name}')">Remove</button>
                        </div>
                    \`;
                    channelsDiv.appendChild(channelDiv);
                });
            } catch (error) {
                console.error('Failed to load channels:', error);
            }
        }
        
        async function testChannel(name) {
            try {
                const response = await fetch(\`/channels/\${name}/test\`, { method: 'POST' });
                const data = await response.json();
                alert(\`Channel \${name}: \${data.message}\`);
                loadChannels();
            } catch (error) {
                alert(\`Failed to test channel \${name}:\${error}\`);
            }
        }
        
        async function removeChannel(name) {
            if (confirm(\`Remove channel \${name}? This will stop the channel.\`)) {
                // TODO: Implement channel removal API
                alert('Channel removal not implemented yet');
            }
        }
        
        // Load channels on page load
        loadChannels();
        
        // Refresh every 30 seconds
        setInterval(loadChannels, 30000);
    </script>
</body>
</html>
    `;
  }

  // ── Public Methods ─────────────────────────────────────────────
  isRunning(): boolean {
    return this.isServerRunning;
  }

  getConfig(): WebhookConfig {
    return this.config;
  }

  getUrl(): string {
    const host = this.getHost();
    const port = this.config.port;
    const protocol = this.config.ssl?.enabled ? "https" : "http";
    return `${protocol}://${host}:${port}`;
  }
}
