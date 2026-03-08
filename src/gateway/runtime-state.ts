import { registry } from "../tools/registry.js";
import { presenceTracker } from "../presence/tracker.js";
import { sessionStore } from "../session/store.js";
import { messageQueue } from "../messages/queue.js";

export interface GatewayRuntimeSnapshot {
  status: "healthy" | "degraded" | "not_ready";
  timestamp: string;
  uptimeSeconds: number;
  memoryRssMb: number;
  websocket: {
    connections: number;
  };
  channels: unknown;
  conversations: unknown;
  agents: Array<{ id: string }>;
  tools: {
    count: number;
    list: string[];
  };
  presence: ReturnType<typeof presenceTracker.getStats>;
  readiness: {
    configLoaded: boolean;
    channelManagerReady: boolean;
    defaultAgentReady: boolean;
  };
  queueDepth: number;
  sessionState: {
    activeCount: number;
    totalCount: number;
    recent: Array<{ id: string; channel: string; lastActivity: string }>;
  };
  presenceSummary: {
    active: number;
    instances: Array<{ id: string; type: string; lastSeen: string }>;
  };
  messageQueue: {
    depth: number;
    pending: number;
    processing: number;
    recent: Array<{ id: string; channel: string; status: string; receivedAt: string }>;
  };
}

export function buildGatewayRuntimeSnapshot(input: {
  startTime: number;
  websocketConnections: number;
  channelStats: unknown;
  conversationStats: unknown;
  agentIds: string[];
  configLoaded: boolean;
  channelManagerReady: boolean;
  defaultAgentReady: boolean;
}): GatewayRuntimeSnapshot {
  const readiness = {
    configLoaded: input.configLoaded,
    channelManagerReady: input.channelManagerReady,
    defaultAgentReady: input.defaultAgentReady,
  };

  const ready = readiness.configLoaded && readiness.channelManagerReady && readiness.defaultAgentReady;

  const now = Date.now();
  const uptime = Math.floor((now - input.startTime) / 1000);

  const sessionState = {
    activeCount: sessionStore.getActiveSessionCount(),
    totalCount: sessionStore.getTotalSessionCount(),
    recent: sessionStore
      .getRecentSessions(5)
      .map((sess) => ({
        id: sess.sessionId,
        channel: sess.channel || "unknown",
        lastActivity: sess.updatedAt ? new Date(sess.updatedAt).toISOString() : "N/A",
      })),
  };

  const presenceSummary = {
    active: presenceTracker.getActiveCount(),
    instances: presenceTracker
      .listInstances()
      .map((inst) => ({
        id: inst.id,
        type: inst.type,
        lastSeen: new Date(inst.lastSeen).toISOString(),
      })),
  };

  const messageQueueState = {
    depth: messageQueue.getDepth(),
    pending: messageQueue.getPendingCount(),
    processing: messageQueue.getProcessingCount(),
    recent: messageQueue
      .getRecentMessages(5)
      .map((msg) => ({
        id: msg.id,
        channel: msg.channel || "unknown",
        status: msg.status,
        receivedAt: new Date(msg.receivedAt).toISOString(),
      })),
  };

  return {
    status: ready ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime,
    memoryRssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    websocket: {
      connections: input.websocketConnections,
    },
    channels: input.channelStats,
    conversations: input.conversationStats,
    agents: input.agentIds.map((id) => ({ id })),
    tools: {
      count: registry.getNames().length,
      list: registry.getNames(),
    },
    presence: presenceTracker.getStats(),
    readiness,
    queueDepth: messageQueue.getDepth(),
    sessionState,
    presenceSummary,
    messageQueue: messageQueueState,
  };
}
