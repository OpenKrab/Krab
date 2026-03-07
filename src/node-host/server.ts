// ============================================================
// 🦀 Krab — Node Host (Device Integration)
// Enable remote device control via pairing
// ============================================================
import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server } from "http";
import { logger } from "../utils/logger.js";

export interface NodeHostOptions {
  port?: number;
  host?: string;
}

export interface PairedNode {
  id: string;
  name: string;
  platform: "macos" | "ios" | "android" | "linux" | "windows";
  capabilities: string[];
  connectedAt: Date;
  lastSeen: Date;
  ws: WebSocket;
}

export interface NodeInvocation {
  action: "run" | "notify" | "screenshot" | "camera" | "location";
  args?: Record<string, unknown>;
  timeout?: number;
}

export class NodeHostServer {
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;
  private host: string;
  private pairingCodes = new Map<string, { code: string; expiresAt: number }>();
  private nodes = new Map<string, PairedNode>();
  private pendingPairing = new Map<string, (node: PairedNode | null) => void>();

  constructor(options: NodeHostOptions = {}) {
    this.port = options.port || 18790;
    this.host = options.host || "127.0.0.1";
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer();
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on("connection", (ws, req) => {
        this.handleConnection(ws, req);
      });

      this.server.listen(this.port, this.host, () => {
        logger.info(`[Node] Host server running on ${this.host}:${this.port}`);
        resolve();
      });

      this.server.on("error", (err) => {
        logger.error("[Node] Server error:", err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.nodes.forEach((node) => {
        node.ws.close();
      });
      this.nodes.clear();

      if (this.wss) this.wss.close();
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  private handleConnection(ws: WebSocket, req: unknown): void {
    const httpReq = req as { url?: string; headers?: { host?: string } };
    const url = new URL(httpReq.url || "/", `http://${httpReq.headers?.host}`);
    const path = url.pathname;

    if (path === "/pair") {
      this.handlePairing(ws);
    } else if (path === "/invoke") {
      this.handleNodeInvocation(ws);
    } else {
      ws.close(4000, "Unknown path");
    }
  }

  private handlePairing(ws: WebSocket): void {
    let buffer = "";
    
    ws.on("message", async (data) => {
      buffer += data.toString();
      
      try {
        const msg = JSON.parse(buffer);
        
        if (msg.type === "request-pair") {
          const code = this.generatePairingCode();
          const nodeId = msg.nodeId || `node-${Date.now()}`;
          
          this.pendingPairing.set(code, (node) => {
            if (node) {
              ws.send(JSON.stringify({ type: "paired", nodeId: node.id }));
            } else {
              ws.send(JSON.stringify({ type: "pairing-failed", error: "Code expired or invalid" }));
            }
          });
          
          ws.send(JSON.stringify({ 
            type: "pairing-code", 
            code,
            expiresIn: 60000 
          }));
        } else if (msg.type === "confirm-pair") {
          const code = msg.code;
          const pending = this.pendingPairing.get(code);
          
          if (pending) {
            const node: PairedNode = {
              id: msg.nodeId || `node-${Date.now()}`,
              name: msg.nodeName || "Unknown Device",
              platform: msg.platform || "unknown",
              capabilities: msg.capabilities || [],
              connectedAt: new Date(),
              lastSeen: new Date(),
              ws,
            };
            
            this.nodes.set(node.id, node);
            pending(node);
            this.pendingPairing.delete(code);
            
            logger.info(`[Node] Paired: ${node.name} (${node.id})`);
          }
        }
      } catch {
        // Incomplete JSON, wait for more data
      }
    });

    ws.on("close", () => {
      this.pendingPairing.forEach((cb) => {
        cb(null);
      });
      this.pendingPairing.clear();
    });
  }

  private generatePairingCode(): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.pairingCodes.set(code, { code, expiresAt: Date.now() + 60000 });
    
    setTimeout(() => {
      this.pairingCodes.delete(code);
    }, 60000);
    
    return code;
  }

  private handleNodeInvocation(ws: WebSocket): void {
    let buffer = "";
    
    ws.on("message", async (data) => {
      buffer += data.toString();
      
      try {
        const msg = JSON.parse(buffer);
        if (msg.type === "invoke") {
          const nodeId = msg.nodeId;
          const node = this.nodes.get(nodeId);
          
          if (!node) {
            ws.send(JSON.stringify({ 
              type: "error", 
              error: `Node not found: ${nodeId}` 
            }));
            return;
          }
          
          const result = await this.invokeNodeOnNode(node, msg.action, msg.args);
          ws.send(JSON.stringify({ type: "result", result }));
        }
      } catch {
        // Wait for more data
      }
    });
  }

  private invokeNodeOnNode(node: PairedNode, action: string, args?: Record<string, unknown>, timeout = 30000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Invocation timeout: ${action}`));
      }, timeout);

      const handler = (msgData: unknown) => {
        try {
          const msg = JSON.parse(String(msgData));
          if (msg.requestId === requestId) {
            clearTimeout(timeoutId);
            node.ws.off("message", handler);
            resolve(msg.result);
          }
        } catch {
          // Ignore parse errors
        }
      };

      node.ws.on("message", handler);
      
      node.ws.send(JSON.stringify({
        type: "invoke",
        requestId,
        action,
        args,
      }));
    });
  }

  async invoke(nodeId: string, action: string, args?: Record<string, unknown>): Promise<unknown> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    return this.invokeNodeOnNode(node, action, args);
  }

  listNodes(): PairedNode[] {
    return Array.from(this.nodes.values());
  }

  getNode(id: string): PairedNode | undefined {
    return this.nodes.get(id);
  }

  disconnectNode(id: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.ws.close();
      this.nodes.delete(id);
      logger.info(`[Node] Disconnected: ${id}`);
    }
  }

  async notifyAll(title: string, body: string): Promise<void> {
    const promises = Array.from(this.nodes.values()).map((node) => 
      this.invokeNodeOnNode(node, "notify", { title, body }).catch(() => null)
    );
    await Promise.all(promises);
  }
}

let nodeHostInstance: NodeHostServer | null = null;

export function getNodeHost(options?: NodeHostOptions): NodeHostServer {
  if (!nodeHostInstance) {
    nodeHostInstance = new NodeHostServer(options);
  }
  return nodeHostInstance;
}

export async function startNodeHost(options?: NodeHostOptions): Promise<NodeHostServer> {
  const host = getNodeHost(options);
  await host.start();
  return host;
}
