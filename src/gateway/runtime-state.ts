import { registry } from "../tools/registry.js";
import { presenceTracker } from "../presence/tracker.js";

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

  return {
    status: ready ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - input.startTime) / 1000),
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
  };
}
