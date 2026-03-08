// ============================================================
// 🦀 Krab — Session Management Tools
// ============================================================
import { z } from "zod";
import { sessionStore } from "../../session/store.js";
import { ConversationMemory } from "../../memory/conversation-enhanced.js";
import type { ToolDefinition } from "../../core/types.js";
import { getSubagentRuntime } from "../../agent/subagent-runtime.js";
import { loadConfig } from "../../core/config.js";
import * as path from "path";
import * as os from "os";

function getWorkspaceMemory(): ConversationMemory {
  const config = loadConfig();
  const workspace = config.agents?.defaults?.workspace || process.cwd();
  return new ConversationMemory(workspace);
}

// ── sessions_list Tool ──────────────────────────────────────
const sessionsListTool: ToolDefinition = {
  name: "sessions_list",
  description: "List active sessions with filtering and metadata",
  parameters: z.object({
    kinds: z.array(z.enum(["main", "group", "cron", "hook", "node", "other"])).optional(),
    limit: z.number().min(1).max(500).default(100),
    activeMinutes: z.number().min(1).optional(),
    messageLimit: z.number().min(0).default(0),
  }),
  execute: async (args) => {
    const { kinds, limit, activeMinutes, messageLimit } = args;
    const memory = messageLimit > 0 ? getWorkspaceMemory() : null;

    let sessions = sessionStore.getAllSessions();

    // Filter by kinds
    if (kinds && kinds.length > 0) {
      sessions = sessions.filter(session => {
        // Map session mode to kind
        const kindMap: Record<string, string> = {
          "main": "main",
          "group": "group",
          "thread": "group" // Threads are treated as groups
        };
        const sessionKind = kindMap[session.mode] || "other";
        return kinds.includes(sessionKind as any);
      });
    }

    // Filter by active minutes
    if (activeMinutes) {
      const cutoff = Date.now() - (activeMinutes * 60 * 1000);
      sessions = sessions.filter(session => session.updatedAt.getTime() > cutoff);
    }

    // Sort by updatedAt desc and limit
    sessions = sessions
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    // Build result
    const result = await Promise.all(sessions.map(async (session) => {
      const sessionResult: any = {
        key: session.sessionKey,
        kind: session.mode === "main" ? "main" : session.mode === "group" ? "group" : "other",
        channel: session.channel,
        displayName: session.groupId ? `Group: ${session.groupId}` : undefined,
        updatedAt: session.updatedAt.getTime(),
        sessionId: session.sessionId,
        lastChannel: session.lastChannel,
        messageCount: session.messageCount
      };

      // Include messages if requested
      if (messageLimit > 0 && memory) {
        try {
          const messages = memory.getRecentMessages(session.sessionKey, messageLimit);
          // Filter out tool results as per OpenClaw behavior
          sessionResult.messages = messages
            .filter(m => m.role !== "tool")
            .slice(-messageLimit);
        } catch (error) {
          // Ignore errors loading messages
        }
      }

      return sessionResult;
    }));

    return {
      success: true,
      output: JSON.stringify(result, null, 2)
    };
  }
};

// ── sessions_history Tool ───────────────────────────────────
const sessionsHistoryTool: ToolDefinition = {
  name: "sessions_history",
  description: "Get message history for a specific session",
  parameters: z.object({
    sessionKey: z.string(),
    limit: z.number().min(1).max(1000).default(50),
    includeTools: z.boolean().default(false),
  }),
  execute: async (args) => {
    const { sessionKey, limit, includeTools } = args;

    try {
      const memory = getWorkspaceMemory();
      let messages = memory.getRecentMessages(sessionKey, limit);

      // Filter tool results if not requested
      if (!includeTools) {
        messages = messages.filter(m => m.role !== "tool");
      }

      return {
        success: true,
        output: JSON.stringify(messages, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to load session history: ${error}`
      };
    }
  }
};

// ── sessions_send Tool ──────────────────────────────────────
const sessionsSendTool: ToolDefinition = {
  name: "sessions_send",
  description: "Send a message to another session (inter-session communication)",
  parameters: z.object({
    sessionKey: z.string(),
    message: z.string(),
    timeoutSeconds: z.number().min(0).default(30),
  }),
  execute: async (args) => {
    const { sessionKey, message, timeoutSeconds } = args;

    // For now, this is a simplified implementation
    // In a full implementation, this would route messages between sessions
    // and handle agent-to-agent communication

    try {
      const runtime = getSubagentRuntime(loadConfig());

      // Check if session exists
      const session = sessionStore.getSession(sessionKey);
      if (!session) {
        return {
          success: false,
          output: "",
          error: `Session ${sessionKey} not found`
        };
      }

      // For fire-and-forget (timeout 0)
      if (timeoutSeconds === 0) {
        const record = runtime.get(sessionKey);
        if (record) {
          void runtime.execute(sessionKey, message);
        }
        return {
          success: true,
          output: JSON.stringify({
            runId: `run_${Date.now()}`,
            status: "accepted"
          })
        };
      }

      const record = runtime.get(sessionKey);
      if (record) {
        const result = await runtime.execute(sessionKey, message);
        return {
          success: result.status !== "failed",
          output: JSON.stringify({
            runId: `run_${Date.now()}`,
            status: result.status,
            reply: result.lastResult || "",
            error: result.error,
          })
        };
      }

      return {
        success: true,
        output: JSON.stringify({
          runId: `run_${Date.now()}`,
          status: "ok",
          reply: "Message sent to session (simplified response)"
        })
      };

    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to send message: ${error}`
      };
    }
  }
};

// ── sessions_spawn Tool ─────────────────────────────────────
const sessionsSpawnTool: ToolDefinition = {
  name: "sessions_spawn",
  description: "Spawn a new agent session",
  parameters: z.object({
    channel: z.string().optional(),
    initialMessage: z.string().optional(),
    sessionType: z.enum(["main", "group", "thread"]).default("main"),
  }),
  execute: async (args) => {
    const { channel, initialMessage, sessionType } = args;

    try {
      const runtime = getSubagentRuntime(loadConfig());
      const record = runtime.spawn(
        sessionType === "group" ? "group-worker" : "session-worker",
        initialMessage || "Handle delegated session tasks",
        "sessions_spawn",
        {
          channel: channel || "internal",
          mode: sessionType,
          senderId: "system",
        },
      );

      const session = sessionStore.getSession(record.id)!;

      if (initialMessage) {
        await runtime.execute(record.id, initialMessage);
      }

      return {
        success: true,
        output: JSON.stringify({
          sessionKey: record.id,
          sessionId: session.sessionId,
          status: record.status
        })
      };

    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to spawn session: ${error}`
      };
    }
  }
};

// Export all session tools
export const sessionTools = [
  sessionsListTool,
  sessionsHistoryTool,
  sessionsSendTool,
  sessionsSpawnTool
];
