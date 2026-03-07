// ============================================================
// 🦀 Krab — Canvas Host (A2UI Protocol)
// Agent-to-UI Protocol for Visual Workspace
// ============================================================
import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { logger } from "../utils/logger.js";
import { Agent } from "../core/agent.js";

export interface CanvasState {
  id: string;
  elements: CanvasElement[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  metadata?: Record<string, any>;
}

export interface CanvasElement {
  id: string;
  type: "text" | "image" | "code" | "chart" | "table" | "list" | "divider" | "button" | "input";
  content?: string;
  src?: string;
  language?: string;
  data?: any;
  style?: Record<string, string>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  actions?: CanvasAction[];
}

export interface CanvasAction {
  id: string;
  label: string;
  action: string;
  payload?: any;
}

export interface CanvasMessage {
  type: "init" | "update" | "push" | "reset" | "eval" | "snapshot" | "action" | "error";
  id?: string;
  state?: CanvasState;
  element?: CanvasElement;
  elements?: CanvasElement[];
  code?: string;
  snapshot?: string;
  action?: string;
  payload?: any;
  error?: string;
}

export type CanvasEventHandler = (msg: CanvasMessage, client: WebSocket) => void;

export class CanvasHost {
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private currentState: CanvasState | null = null;
  private agent: Agent;
  private eventHandlers: Map<string, CanvasEventHandler> = new Map();
  private port: number;
  private bind: string;

  constructor(agent: Agent, options: { port?: number; bind?: string } = {}) {
    this.agent = agent;
    this.port = options.port || 3030;
    this.bind = options.bind || "127.0.0.1";
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on("connection", (ws, req) => {
        this.handleClientConnection(ws, req);
      });

      this.server.listen(this.port, this.bind, () => {
        logger.info(`[Canvas] Host listening on http://${this.bind}:${this.port}`);
        resolve();
      });

      this.server.on("error", (error) => {
        logger.error("[Canvas] Server error:", error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.server) {
            this.server.close(() => {
              logger.info("[Canvas] Host stopped");
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(this.getIndexHtml());
      return;
    }

    if (url.pathname === "/ws") {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("WebSocket endpoint is /canvas-ws");
      return;
    }

    if (url.pathname === "/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.currentState || { elements: [] }));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }

  private handleClientConnection(ws: WebSocket, req: IncomingMessage): void {
    this.clients.add(ws);
    logger.info(`[Canvas] Client connected (total: ${this.clients.size})`);

    // Send initial state
    this.sendToClient(ws, {
      type: "init",
      state: this.currentState || { id: "default", elements: [] }
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as CanvasMessage;
        this.handleClientMessage(msg, ws);
      } catch (error) {
        logger.error("[Canvas] Invalid message:", error);
        ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      this.clients.delete(ws);
      logger.info(`[Canvas] Client disconnected (total: ${this.clients.size})`);
    });

    ws.on("error", (error) => {
      logger.error("[Canvas] Client error:", error);
    });
  }

  private handleClientMessage(msg: CanvasMessage, client: WebSocket): void {
    switch (msg.type) {
      case "eval":
        this.handleEval(msg, client);
        break;
      case "action":
        this.handleAction(msg, client);
        break;
      case "snapshot":
        this.handleSnapshot(msg, client);
        break;
      default:
        logger.warn(`[Canvas] Unknown message type: ${msg.type}`);
    }
  }

  private async handleEval(msg: CanvasMessage, client: WebSocket): Promise<void> {
    if (!msg.code) {
      client.send(JSON.stringify({ type: "error", error: "No code provided" }));
      return;
    }

    try {
      // Execute code via agent or directly
      const result = await this.agent.chat(msg.code, { conversationId: "canvas" });
      
      client.send(JSON.stringify({
        type: "update",
        element: {
          id: msg.id || "eval-result",
          type: "code",
          content: result,
          language: "markdown"
        }
      }));
    } catch (error) {
      client.send(JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      }));
    }
  }

  private async handleAction(msg: CanvasMessage, client: WebSocket): Promise<void> {
    const actionId = msg.action;
    const payload = msg.payload;

    logger.info(`[Canvas] Action: ${actionId}`, payload);

    // Dispatch to registered handlers
    const handler = this.eventHandlers.get(actionId || "");
    if (handler) {
      handler(msg, client);
    } else {
      // Forward to agent
      const response = await this.agent.chat(
        `User performed action: ${actionId}\nPayload: ${JSON.stringify(payload)}`,
        { conversationId: "canvas" }
      );

      this.pushToCanvas({
        id: `action-response-${Date.now()}`,
        type: "text",
        content: response
      });
    }
  }

  private handleSnapshot(msg: CanvasMessage, client: WebSocket): void {
    client.send(JSON.stringify({
      type: "snapshot",
      snapshot: JSON.stringify(this.currentState)
    }));
  }

  // ── Public API ────────────────────────────────────────────────
  pushToCanvas(element: CanvasElement): void {
    if (!this.currentState) {
      this.currentState = { id: "default", elements: [] };
    }

    this.currentState.elements.push(element);

    this.broadcast({
      type: "push",
      element
    });
  }

  updateCanvas(element: CanvasElement): void {
    if (!this.currentState) return;

    const index = this.currentState.elements.findIndex(e => e.id === element.id);
    if (index >= 0) {
      this.currentState.elements[index] = element;
    }

    this.broadcast({
      type: "update",
      element
    });
  }

  resetCanvas(state?: CanvasState): void {
    this.currentState = state || { id: `reset-${Date.now()}`, elements: [] };

    this.broadcast({
      type: "reset",
      state: this.currentState
    });
  }

  evalCode(code: string): void {
    this.broadcast({
      type: "eval",
      code
    });
  }

  getSnapshot(): string {
    return JSON.stringify(this.currentState);
  }

  onAction(actionId: string, handler: CanvasEventHandler): void {
    this.eventHandlers.set(actionId, handler);
  }

  private sendToClient(ws: WebSocket, msg: CanvasMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: CanvasMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  getStats() {
    return {
      port: this.port,
      clients: this.clients.size,
      stateElements: this.currentState?.elements.length || 0
    };
  }

  private getIndexHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Krab Canvas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
    }
    .header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .status { 
      display: flex; 
      align-items: center; 
      gap: 8px; 
      font-size: 13px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #238636;
    }
    .status-dot.disconnected { background: #da3633; }
    #canvas {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .element {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .element.text { white-space: pre-wrap; }
    .element.code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      background: #0d1117;
    }
    .element.image img {
      max-width: 100%;
      border-radius: 4px;
    }
    .element.chart, .element.table { overflow-x: auto; }
    .input-area {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #161b22;
      border-top: 1px solid #30363d;
      padding: 12px 20px;
      display: flex;
      gap: 8px;
    }
    .input-area input {
      flex: 1;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 14px;
      color: #c9d1d9;
      font-size: 14px;
    }
    .input-area input:focus {
      outline: none;
      border-color: #58a6ff;
    }
    .input-area button {
      background: #238636;
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    .input-area button:hover { background: #2ea043; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🦀 Krab Canvas</h1>
    <div class="status">
      <div class="status-dot" id="status-dot"></div>
      <span id="status-text">Connecting...</span>
    </div>
  </div>
  
  <div id="canvas"></div>
  
  <div class="input-area">
    <input type="text" id="input" placeholder="Type a message..." autocomplete="off">
    <button id="send">Send</button>
  </div>

  <script>
    const canvas = document.getElementById('canvas');
    const input = document.getElementById('input');
    const send = document.getElementById('send');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    let ws;
    let messageId = 0;

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(\`\${protocol}//\${location.host}/canvas-ws\`);

      ws.onopen = () => {
        statusDot.classList.remove('disconnected');
        statusText.textContent = 'Connected';
      };

      ws.onclose = () => {
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      };
    }

    function handleMessage(msg) {
      switch (msg.type) {
        case 'init':
        case 'reset':
          canvas.innerHTML = '';
          if (msg.state?.elements) {
            msg.state.elements.forEach(renderElement);
          }
          break;
        case 'push':
          renderElement(msg.element);
          break;
        case 'update':
          const el = document.getElementById(msg.element.id);
          if (el) el.outerHTML = renderElement(msg.element);
          break;
      }
    }

    function renderElement(el) {
      const div = document.createElement('div');
      div.className = 'element ' + el.type;
      div.id = el.id || 'el-' + messageId++;
      
      switch (el.type) {
        case 'text':
          div.textContent = el.content;
          break;
        case 'code':
          div.innerHTML = '<pre>' + escapeHtml(el.content) + '</pre>';
          break;
        case 'image':
          div.innerHTML = '<img src="' + el.src + '" alt="' + (el.content || '') + '">';
          break;
        default:
          div.textContent = JSON.stringify(el);
      }
      
      canvas.appendChild(div);
      return div.outerHTML;
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      
      ws.send(JSON.stringify({
        type: 'eval',
        code: text,
        id: 'msg-' + Date.now()
      }));
      
      input.value = '';
    }

    send.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    connect();
  </script>
</body>
</html>`;
  }
}

export function createCanvasHost(agent: Agent, options?: { port?: number; bind?: string }): CanvasHost {
  return new CanvasHost(agent, options);
}
