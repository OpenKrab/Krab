import * as readline from "node:readline/promises";
import pc from "picocolors";
import { stdin as input, stdout as output } from "node:process";
import { Agent } from "../core/agent.js";
import { loadConfig } from "../core/config.js";
import { getSubagentRuntime } from "../agent/subagent-runtime.js";
import { memoryManager } from "../memory/manager.js";
import { getRoutingDiagnostics, clearRoutingDiagnostics } from "../messages/diagnostics.js";
import { getToolExecutionDiagnostics, clearToolExecutionDiagnostics } from "../tools/diagnostics.js";
import { printBanner, printKeyValue, printSection, printInfo, printWarning } from "./style.js";

function renderHeader(agent: Agent) {
  const config = agent.getConfig();
  printBanner("Krab Control TUI");
  printKeyValue("Provider", config.provider?.name || "unknown");
  printKeyValue("Model", config.provider?.model || "unknown");
  printKeyValue("Workspace", config.agents?.defaults?.workspace || process.cwd());
}

function renderHelp() {
  printSection("Commands");
  console.log(`  ${pc.cyan("/chat <message>")}              ${pc.dim("Transmit a message into the control grid")}`);
  console.log(`  ${pc.cyan("/gateway")}                     ${pc.dim("Inspect gateway reactor and signal state")}`);
  console.log(`  ${pc.cyan("/memory")}                      ${pc.dim("Read memory reservoir telemetry")}`);
  console.log(`  ${pc.cyan("/memory find <q>")}             ${pc.dim("Search hybrid memory fragments")}`);
  console.log(`  ${pc.cyan("/routes")}                      ${pc.dim("Show routing diagnostics")}`);
  console.log(`  ${pc.cyan("/routes clear")}                ${pc.dim("Purge routing traces")}`);
  console.log(`  ${pc.cyan("/status")}                      ${pc.dim("Show runtime summary")}`);
  console.log(`  ${pc.cyan("/subagents")}                   ${pc.dim("Inspect delegated worker lattice")}`);
  console.log(`  ${pc.cyan("/subagents inspect <id>")}      ${pc.dim("Open one worker inspection panel")}`);
  console.log(`  ${pc.cyan("/subagents kill <id>")}         ${pc.dim("Issue cancellation to active worker")}`);
  console.log(`  ${pc.cyan("/tools")}                       ${pc.dim("Show recent tool execution traces")}`);
  console.log(`  ${pc.cyan("/tools filter <name>")}         ${pc.dim("Filter tool traces by tool name")}`);
  console.log(`  ${pc.cyan("/tools clear")}                 ${pc.dim("Clear tool trace buffer")}`);
  console.log(`  ${pc.cyan("/clear")}                       ${pc.dim("Refresh the HUD")}`);
  console.log(`  ${pc.cyan("/exit")}                        ${pc.dim("Power down control grid")}`);
  console.log("");
}

export function renderSubagentInspect(agent: Agent, id: string) {
  const runtime = getSubagentRuntime(agent.getConfig());
  const entry = runtime.get(id);
  printSection(`Subagent Inspect: ${id}`);
  if (!entry) {
    printWarning("Subagent not found.");
    console.log("");
    return;
  }

  printKeyValue("Role", entry.role);
  printKeyValue("Goal", entry.goal);
  printKeyValue("Status", entry.status);
  printKeyValue("Parent", entry.parentConversationId);
  printKeyValue("Last Task", entry.lastTask || "none");
  printKeyValue("Last Result", entry.lastResult || "none");
  printKeyValue("Error", entry.error || "none");
  console.log("");
}

function renderStatus(agent: Agent) {
  const config = agent.getConfig();
  const stats = agent.getMemoryStats();
  printSection("Runtime Status");
  printKeyValue("Debug", String(config.debug || false));
  printKeyValue("Max Iterations", String(config.maxIterations || 5));
  printKeyValue("Max Retries", String(config.maxRetries || 3));
  printKeyValue("Memory Conversations", String(stats.totalConversations));
  printKeyValue("Memory Messages", String(stats.totalMessages));
  console.log("");
}

function renderMemory(agent: Agent) {
  const stats = agent.getMemoryStats();
  printSection("Memory Overview");
  printKeyValue("Total Conversations", String(stats.totalConversations));
  printKeyValue("Total Messages", String(stats.totalMessages));
  printKeyValue("Average / Conversation", String(stats.averageMessagesPerConversation));
  printKeyValue("Oldest", stats.oldestConversation?.toISOString() || "none");
  printKeyValue("Newest", stats.newestConversation?.toISOString() || "none");
  console.log("");
}

function renderRoutes() {
  const routes = getRoutingDiagnostics();
  printSection("Routing Diagnostics");
  if (routes.length === 0) {
    printInfo("No routing diagnostics recorded yet.");
    console.log("");
    return;
  }

  for (const route of routes.slice(-10).reverse()) {
    console.log(
      `  ${pc.gray(route.timestamp)} ${pc.cyan(route.channelName)} ${pc.yellow(route.senderId)} ${pc.green(route.matchedAgentId || "unknown")} ${pc.dim(route.reason)}`,
    );
  }
  console.log("");
}

export function renderToolDiagnostics(filterName?: string) {
  const entries = getToolExecutionDiagnostics().filter((entry) => !filterName || entry.toolName === filterName);
  printSection("Tool Diagnostics");
  if (entries.length === 0) {
    printInfo(filterName ? `No tool executions recorded for ${filterName}.` : "No tool executions recorded yet.");
    console.log("");
    return;
  }

  for (const entry of entries.slice(-10).reverse()) {
    const status = entry.success ? pc.green("ok") : pc.red("fail");
    const mode = entry.sideEffect ? pc.yellow("mut") : pc.cyan("ro");
    const phase = entry.phase ? pc.dim(`[${entry.phase}]`) : "";
    const decision = entry.decision ? pc.magenta(entry.decision) : "";
    console.log(
      `  ${pc.gray(entry.timestamp)} ${status} ${mode} ${phase} ${pc.bold(entry.toolName)} ${decision} ${pc.dim(`${entry.durationMs}ms`)}${entry.reason ? ` ${pc.dim(entry.reason)}` : ""}${entry.error ? ` ${pc.red(entry.error)}` : ""}`,
    );
  }
  console.log("");
}

async function renderGatewayStatus(agent: Agent): Promise<void> {
  const config = agent.getConfig();
  const port = config.gateway?.port || 18789;
  printSection("Gateway Runtime");

  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`);
    if (!response.ok) {
      printWarning(`Gateway responded with status ${response.status}`);
      console.log("");
      return;
    }

    const status = await response.json() as any;
    printKeyValue("Status", String(status.status || "unknown"));
    printKeyValue("Uptime", String(status.uptimeSeconds ?? "unknown"));
    printKeyValue("WebSocket", String(status.websocket?.connections ?? 0));
    printKeyValue("Agents", String(status.agents?.length ?? 0));
    printKeyValue("Tools", String(status.tools?.count ?? 0));
    printKeyValue("Presence Active", String(status.presence?.active ?? 0));
    printKeyValue("Config Loaded", String(status.readiness?.configLoaded ?? false));
    console.log("");
  } catch {
    printWarning("Gateway is unavailable on the local control port.");
    console.log("");
  }
}

function renderSubagents(agent: Agent) {
  const runtime = getSubagentRuntime(agent.getConfig());
  const entries = runtime.list();
  const events = runtime.getEvents(10);
  printSection("Subagent Runtime");
  if (entries.length === 0) {
    printInfo("No subagents spawned yet.");
    console.log("");
    return;
  }

  for (const entry of entries.slice(-10).reverse()) {
    const status = entry.status === "completed"
      ? pc.green(entry.status)
      : entry.status === "failed"
        ? pc.red(entry.status)
        : entry.status === "running"
          ? pc.yellow(entry.status)
          : pc.cyan(entry.status);
    console.log(
      `  ${pc.bold(entry.id)} ${status} ${pc.dim(entry.role)} ${entry.lastTask ? pc.dim(`- ${entry.lastTask}`) : ""}`,
    );
  }
  if (events.length > 0) {
    console.log("");
    printInfo("Recent lifecycle events:");
    for (const event of events.slice(-5).reverse()) {
      console.log(
        `  ${pc.gray(event.timestamp)} ${pc.cyan(event.subagentId)} ${pc.yellow(event.type)} ${pc.dim(event.task || "")}${event.error ? ` ${pc.red(event.error)}` : ""}`,
      );
    }
  }
  console.log("");
}

async function renderMemorySearch(query: string) {
  const results = await memoryManager.getHybridMemoryResultsAsync(query, { limit: 5, conversationLimit: 5 });
  printSection(`Memory Search: ${query}`);
  if (results.length === 0) {
    printInfo("No memory matches found.");
    console.log("");
    return;
  }

  for (const result of results) {
    console.log(
      `  ${pc.bold(result.id)} ${pc.cyan(result.source)} ${pc.dim(`score=${result.score}`)}`,
    );
    console.log(`  ${pc.gray(result.preview.replace(/\n/g, " "))}`);
  }
  console.log("");
}

async function handleChat(agent: Agent, content: string): Promise<void> {
  if (!content.trim()) {
    printWarning("Usage: /chat <message>");
    console.log("");
    return;
  }

  process.stdout.write(pc.dim("⌁ calibrating reactor thought-path...\r"));
  const response = await agent.chat(content);
  process.stdout.write(" ".repeat(48) + "\r");
  printSection("Assistant");
  console.log(`  ${response.replace(/\n/g, "\n  ")}`);
  console.log("");
}

export async function runDashboard(): Promise<void> {
  console.clear();
  const config = loadConfig();
  const agent = new Agent(config);
  const rl = readline.createInterface({ input, output });

  renderHeader(agent);
  renderHelp();

  while (true) {
    const answer = await rl.question(`${pc.bold(pc.cyan("krab"))}` + `${pc.dim(" :: reactor> ")}`);
    const trimmed = answer.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === "/exit" || trimmed === "/quit") {
      break;
    }

    if (trimmed === "/clear") {
      console.clear();
      renderHeader(agent);
      renderHelp();
      continue;
    }

    if (trimmed === "/memory") {
      renderMemory(agent);
      continue;
    }

    if (trimmed.startsWith("/memory find ")) {
      await renderMemorySearch(trimmed.slice("/memory find ".length).trim());
      continue;
    }

    if (trimmed === "/gateway") {
      await renderGatewayStatus(agent);
      continue;
    }

    if (trimmed === "/subagents") {
      renderSubagents(agent);
      continue;
    }

    if (trimmed.startsWith("/subagents inspect ")) {
      renderSubagentInspect(agent, trimmed.slice("/subagents inspect ".length).trim());
      continue;
    }

    if (trimmed.startsWith("/subagents kill ")) {
      const id = trimmed.slice("/subagents kill ".length).trim();
      const runtime = getSubagentRuntime(agent.getConfig());
      const killed = runtime.kill(id);
      if (killed) {
        printInfo(`Subagent ${id} cancellation requested.`);
      } else {
        printWarning(`Subagent ${id} not found.`);
      }
      console.log("");
      continue;
    }

    if (trimmed === "/routes") {
      renderRoutes();
      continue;
    }

    if (trimmed === "/tools") {
      renderToolDiagnostics();
      continue;
    }

    if (trimmed.startsWith("/tools filter ")) {
      renderToolDiagnostics(trimmed.slice("/tools filter ".length).trim());
      continue;
    }

    if (trimmed === "/tools clear") {
      clearToolExecutionDiagnostics();
      printInfo("Tool diagnostics cleared.");
      console.log("");
      continue;
    }

    if (trimmed === "/routes clear") {
      clearRoutingDiagnostics();
      printInfo("Routing diagnostics cleared.");
      console.log("");
      continue;
    }

    if (trimmed === "/status") {
      renderStatus(agent);
      continue;
    }

    if (trimmed.startsWith("/chat ")) {
      await handleChat(agent, trimmed.slice(6));
      continue;
    }

    if (trimmed === "/help") {
      renderHelp();
      continue;
    }

    await handleChat(agent, trimmed);
  }

  rl.close();
}
