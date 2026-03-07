// ============================================================
// 🦀 Krab — Canvas Host Server (A2UI Protocol)
// Agent-to-UI visual workspace
// ============================================================
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server } from "http";
import { logger } from "../utils/logger.js";

export interface CanvasHostOptions {
  port?: number;
  host?: string;
  rootDir?: string;
}

export interface A2UIFrame {
  type: "html" | "json" | "text" | "error";
  content: string;
  timestamp: number;
  sessionId?: string;
}

export interface CanvasCommand {
  id: string;
  action: "push" | "reset" | "eval" | "snapshot" | "event";
  payload?: any;
  sessionId?: string;
}

export class CanvasHostServer {
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;
  private host: string;
  private rootDir: string;
  private sessions: Map<string, Set<WebSocket>> = new Map();
  private currentFrame: A2UIFrame | null = null;

  constructor(options: CanvasHostOptions = {}) {
    this.port = options.port || 3030;
    this.host = options.host || "127.0.0.1";
    this.rootDir = options.rootDir || "./canvas";
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on("connection", (ws, req) => {
        this.handleWebSocketConnection(ws, req);
      });

      this.server.listen(this.port, this.host, () => {
        logger.info(`[Canvas] A2UI server running at http://${this.host}:${this.port}`);
        resolve();
      });

      this.server.on("error", (err) => {
        logger.error("[Canvas] Server error:", err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
      }
      if (this.server) {
        this.server.close(() => {
          logger.info("[Canvas] Server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve current frame
    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(this.getIndexHTML());
      return;
    }

    if (path === "/frame") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.currentFrame || { type: "text", content: "", timestamp: 0 }));
      return;
    }

    if (path === "/ws") {
      // Upgrade to WebSocket
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  }

  private handleWebSocketConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("session") || "default";

    // Add to session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId)!.add(ws);

    logger.info(`[Canvas] WebSocket connected: ${sessionId}`);

    // Send current frame
    if (this.currentFrame) {
      ws.send(JSON.stringify({ type: "frame", ...this.currentFrame }));
    }

    ws.on("message", (data) => {
      try {
        const cmd = JSON.parse(data.toString()) as CanvasCommand;
        this.handleCommand(cmd, ws);
      } catch (e) {
        logger.error("[Canvas] Invalid command:", e);
      }
    });

    ws.on("close", () => {
      this.sessions.get(sessionId)?.delete(ws);
      logger.info(`[Canvas] WebSocket disconnected: ${sessionId}`);
    });
  }

  private handleCommand(cmd: CanvasCommand, ws: WebSocket): void {
    switch (cmd.action) {
      case "push":
        if (typeof cmd.payload === "string") {
          this.pushFrame(cmd.payload, "html", cmd.sessionId);
        } else if (cmd.payload?.content) {
          this.pushFrame(cmd.payload.content, cmd.payload.type || "html", cmd.sessionId);
        }
        break;
      case "reset":
        this.resetCanvas(cmd.sessionId);
        break;
      case "eval":
        this.evalInCanvas(cmd.payload, ws);
        break;
      case "snapshot":
        this.getSnapshot(ws);
        break;
    }
  }

  // ── A2UI Operations ───────────────────────────────────────────

  pushFrame(content: string, type: "html" | "json" | "text" | "error" = "html", sessionId?: string): void {
    this.currentFrame = {
      type,
      content,
      timestamp: Date.now(),
      sessionId,
    };

    const payload = JSON.stringify({ type: "frame", ...this.currentFrame });

    if (sessionId) {
      // Send to specific session
      this.sessions.get(sessionId)?.forEach((ws) => {
        ws.send(payload);
      });
    } else {
      // Broadcast to all
      this.sessions.forEach((clients) => {
        clients.forEach((ws) => {
          ws.send(payload);
        });
      });
    }

    logger.debug(`[Canvas] Pushed frame: ${type} (${content.length} chars)`);
  }

  resetCanvas(sessionId?: string): void {
    this.currentFrame = null;

    const payload = JSON.stringify({ type: "reset", timestamp: Date.now() });

    if (sessionId) {
      this.sessions.get(sessionId)?.forEach((ws) => { ws.send(payload); });
    } else {
      this.sessions.forEach((clients) => {
        clients.forEach((ws) => { ws.send(payload); });
      });
    }

    logger.debug("[Canvas] Canvas reset");
  }

  evalInCanvas(script: string, ws: WebSocket): void {
    // Evaluate JS in the canvas context
    const payload = JSON.stringify({
      type: "eval",
      script,
      timestamp: Date.now(),
    });
    ws.send(payload);
  }

  getSnapshot(ws: WebSocket): void {
    const payload = JSON.stringify({
      type: "snapshot",
      frame: this.currentFrame,
      timestamp: Date.now(),
    });
    ws.send(payload);
  }

  sendEvent(event: string, data: any, sessionId?: string): void {
    const payload = JSON.stringify({
      type: "event",
      event,
      data,
      timestamp: Date.now(),
    });

    if (sessionId) {
      this.sessions.get(sessionId)?.forEach((ws) => { ws.send(payload); });
    } else {
      this.sessions.forEach((clients) => {
        clients.forEach((ws) => { ws.send(payload); });
      });
    }
  }

  // ── HTML Helpers ─────────────────────────────────────────────

  pushHTML(html: string, sessionId?: string): void {
    this.pushFrame(html, "html", sessionId);
  }

  pushJSON(json: any, sessionId?: string): void {
    this.pushFrame(JSON.stringify(json, null, 2), "json", sessionId);
  }

  pushText(text: string, sessionId?: string): void {
    this.pushFrame(text, "text", sessionId);
  }

  pushError(error: string, sessionId?: string): void {
    this.pushFrame(error, "error", sessionId);
  }

  // ── Index HTML ───────────────────────────────────────────────

  private getIndexHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Krab Canvas</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      height: 100%;
      background: #0d1117;
      color: #c9d1d9;
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    }
    #app {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    }
    header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #58a6ff;
    }
    #status {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #238636;
      color: #fff;
    }
    #status.disconnected {
      background: #da3633;
    }
    #canvas {
      flex: 1;
      overflow: auto;
      padding: 20px;
    }
    #canvas:empty::after {
      content: "Waiting for agent...";
      display: block;
      text-align: center;
      color: #8b949e;
      margin-top: 100px;
    }
    .error {
      background: #da3633;
      color: #fff;
      padding: 12px 16px;
      border-radius: 6px;
      margin: 20px;
    }
  </style>
</head>
<body>
  <div id="app">
    <header>
      <h1>Krab Canvas</h1>
      <span id="status">Connected</span>
    </header>
    <div id="canvas"></div>
  </div>
  <script>
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
    
    let ws;
    let reconnectTimer;
    
    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + location.host + '/ws');
      
      ws.onopen = () => {
        status.textContent = 'Connected';
        status.classList.remove('disconnected');
        clearTimeout(reconnectTimer);
      };
      
      ws.onclose = () => {
        status.textContent = 'Disconnected';
        status.classList.add('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'frame':
            renderFrame(data);
            break;
          case 'reset':
            canvas.innerHTML = '';
            break;
          case 'eval':
            try {
              eval(data.script);
            } catch (e) {
              console.error('Eval error:', e);
            }
            break;
          case 'event':
            window.dispatchEvent(new CustomEvent(data.event, { detail: data.data }));
            break;
        }
      };
    }
    
    function renderFrame(data) {
      canvas.innerHTML = '';
      
      if (data.contentType === 'html') {
        canvas.innerHTML = data.content;
      } else if (data.contentType === 'json') {
        const pre = document.createElement('pre');
        pre.textContent = data.content;
        pre.style.cssText = 'background: #161b22; padding: 16px; border-radius: 6px; overflow: auto;';
        canvas.appendChild(pre);
      } else if (data.contentType === 'error') {
        const div = document.createElement('div');
        div.className = 'error';
        div.textContent = data.content;
        canvas.appendChild(div);
      } else {
        const pre = document.createElement('pre');
        pre.textContent = data.content;
        canvas.appendChild(pre);
      }
    }
    
    connect();
  </script>
</body>
</html>`;
  }

  getUrl(): string {
    return `http://${this.host}:${this.port}`;
  }
}

// ── Singleton instance ────────────────────────────────────────
let canvasInstance: CanvasHostServer | null = null;

export function getCanvasHost(options?: CanvasHostOptions): CanvasHostServer {
  if (!canvasInstance) {
    canvasInstance = new CanvasHostServer(options);
  }
  return canvasInstance;
}

export function startCanvasHost(options?: CanvasHostOptions): Promise<CanvasHostServer> {
  const host = getCanvasHost(options);
  return host.start().then(() => host);
}
