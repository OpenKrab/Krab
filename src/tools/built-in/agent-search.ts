// ============================================================
// 🦀 Krab — Built-in Tool: Agent Search (Multi-Agent Delegation)
// Delegate search tasks to other AI agents on the system
// Supports: Kilocode, OpenCode, Claude Code, Gemini, Codex, etc.
// ============================================================
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "../../core/types.js";
import { logger } from "../../utils/logger.js";

const execAsync = promisify(exec);

// ── Agent Definitions ──────────────────────────────────────
interface AgentDef {
  name: string;
  description: string;
  command: (query: string) => string;
  detectCommand: string; // Command to check if agent is installed
  timeout: number; // ms
}

const AGENTS: AgentDef[] = [
  {
    name: "kilocode",
    description: "Kilocode AI coding agent (free models available)",
    command: (q) => `kilocode ask "${q.replace(/"/g, '\\"')}"`,
    detectCommand: "kilocode --version",
    timeout: 60000,
  },
  {
    name: "opencode",
    description: "OpenCode Zen AI agent",
    command: (q) => `opencode ask "${q.replace(/"/g, '\\"')}"`,
    detectCommand: "opencode --version",
    timeout: 60000,
  },
  {
    name: "claude",
    description: "Claude Code (Anthropic CLI agent)",
    command: (q) => `claude -p "${q.replace(/"/g, '\\"')}"`,
    detectCommand: "claude --version",
    timeout: 120000,
  },
  {
    name: "gemini",
    description: "Gemini CLI (Google AI agent)",
    command: (q) => `gemini -p "${q.replace(/"/g, '\\"')}"`,
    detectCommand: "gemini --version",
    timeout: 120000,
  },
  {
    name: "codex",
    description: "OpenAI Codex CLI agent",
    command: (q) => `codex "${q.replace(/"/g, '\\"')}"`,
    detectCommand: "codex --version",
    timeout: 120000,
  },
  {
    name: "aider",
    description: "Aider AI pair programming agent",
    command: (q) =>
      `aider --message "${q.replace(/"/g, '\\"')}" --no-auto-commits --yes`,
    detectCommand: "aider --version",
    timeout: 120000,
  },
];

// ── Detect installed agents ────────────────────────────────
let cachedAgents: string[] | null = null;

async function detectInstalledAgents(): Promise<string[]> {
  if (cachedAgents) return cachedAgents;

  const installed: string[] = [];

  for (const agent of AGENTS) {
    try {
      await execAsync(agent.detectCommand, { timeout: 5000 });
      installed.push(agent.name);
    } catch {
      // Agent not installed — skip
    }
  }

  cachedAgents = installed;
  logger.debug(
    `[AgentSearch] Detected agents: ${installed.join(", ") || "(none)"}`,
  );
  return installed;
}

// ── Call a specific agent ──────────────────────────────────
async function callAgent(agentName: string, query: string): Promise<string> {
  const agent = AGENTS.find((a) => a.name === agentName);
  if (!agent) throw new Error(`Unknown agent: ${agentName}`);

  const cmd = agent.command(query);
  logger.debug(`[AgentSearch] Calling ${agentName}: ${cmd}`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: agent.timeout,
      maxBuffer: 1024 * 1024 * 2, // 2MB
      cwd: process.cwd(),
    });

    const output = (stdout || stderr || "").trim();
    if (!output) return `Agent "${agentName}" returned no output.`;

    // Cap output to avoid flooding memory
    return output.length > 8000
      ? output.slice(0, 8000) + "\n\n... (output truncated)"
      : output;
  } catch (err: any) {
    if (err.killed)
      throw new Error(
        `Agent "${agentName}" timed out after ${agent.timeout / 1000}s`,
      );
    throw new Error(
      `Agent "${agentName}" failed: ${err.message?.slice(0, 300)}`,
    );
  }
}

// ── Tool: List Available Agents ────────────────────────────
export const agentListTool: ToolDefinition = {
  name: "agent_list",
  description:
    "List all AI agents available on this system (Kilocode, OpenCode, Claude Code, Gemini, Codex, Aider, etc.)",
  parameters: z.object({}),
  sideEffect: false,
  requireApproval: false,
  execute: async () => {
    const installed = await detectInstalledAgents();

    if (installed.length === 0) {
      return {
        success: true,
        output:
          "No external AI agents detected on this system.\nInstall one: kilocode, opencode, claude, gemini, codex, or aider.",
      };
    }

    const lines = installed.map((name) => {
      const agent = AGENTS.find((a) => a.name === name)!;
      return `✅ ${name} — ${agent.description}`;
    });

    const notInstalled = AGENTS.filter((a) => !installed.includes(a.name)).map(
      (a) => `❌ ${a.name} — ${a.description} (not installed)`,
    );

    return {
      success: true,
      output: [
        "**Installed Agents:**",
        ...lines,
        "",
        "**Not Installed:**",
        ...notInstalled,
      ].join("\n"),
    };
  },
};

// ── Tool: Ask Agent ────────────────────────────────────────
export const agentAskTool: ToolDefinition = {
  name: "agent_ask",
  description:
    "Delegate a question or research task to another AI agent on this system. Use this when you need a second opinion, deeper research, or specialized knowledge from agents like Kilocode, OpenCode, Claude Code, Gemini, or Codex.",
  parameters: z.object({
    agent: z
      .string()
      .describe(
        "Agent name: kilocode, opencode, claude, gemini, codex, or aider",
      ),
    query: z.string().describe("The question or task to send to the agent"),
  }),
  sideEffect: true, // Runs external process
  requireApproval: true, // User must approve delegating to another agent
  execute: async (args) => {
    const { agent, query } = args;

    // Check if agent is available
    const installed = await detectInstalledAgents();
    if (!installed.includes(agent)) {
      // Try to find the best available alternative
      if (installed.length > 0) {
        return {
          success: false,
          output: "",
          error: `Agent "${agent}" is not installed. Available agents: ${installed.join(", ")}. Try one of those instead.`,
        };
      }
      return {
        success: false,
        output: "",
        error: `Agent "${agent}" is not installed. No external agents detected on this system.`,
      };
    }

    try {
      const result = await callAgent(agent, query);
      return {
        success: true,
        output: `**Response from ${agent}:**\n\n${result}`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: err.message,
      };
    }
  },
};

// ── Tool: Ask All Agents (Multi-Agent Search) ──────────────
export const agentSearchAllTool: ToolDefinition = {
  name: "agent_search_all",
  description:
    "Send the same question to ALL available AI agents on this system and collect their responses. Useful for getting multiple perspectives or comprehensive research.",
  parameters: z.object({
    query: z.string().describe("The question to send to all available agents"),
  }),
  sideEffect: true,
  requireApproval: true,
  execute: async (args) => {
    const { query } = args;
    const installed = await detectInstalledAgents();

    if (installed.length === 0) {
      return {
        success: false,
        output: "",
        error: "No external AI agents detected on this system.",
      };
    }

    const results: string[] = [];
    let successCount = 0;

    // Call all agents in parallel
    const promises = installed.map(async (name) => {
      try {
        const result = await callAgent(name, query);
        successCount++;
        return `## 🤖 ${name}\n${result}`;
      } catch (err: any) {
        return `## ❌ ${name}\nFailed: ${err.message}`;
      }
    });

    const responses = await Promise.all(promises);
    results.push(...responses);

    return {
      success: successCount > 0,
      output: [
        `**Multi-Agent Search** (${successCount}/${installed.length} responded)`,
        "",
        ...results,
      ].join("\n\n"),
      error:
        successCount === 0 ? "No agents responded successfully." : undefined,
    };
  },
};
