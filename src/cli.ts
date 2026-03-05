// ============================================================
// 🦀 Krab — CLI (Power Terminal Interface)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as readline from "node:readline/promises";
import { loadConfig } from "./core/config.js";
import { Agent } from "./core/agent.js";
import { registry } from "./tools/registry.js";
import { logger } from "./utils/logger.js";
import { GatewayServer } from "./gateway/server.js";
import { runChat } from "./tui/chat.js";
import { startTUI } from "./tui/ink-app.js";
import { runOnboarding } from "./cli/onboarding.js";
import { gatewayCmd, configCmd, channelsCmd, mcpCmd, jobCmd } from "./cli/gateway-commands.js";

// ── Register Built-in Tools ────────────────────────────────
import { datetimeTool } from "./tools/built-in/datetime.js";
import { shellTool } from "./tools/built-in/shell.js";
import {
  agentListTool,
  agentAskTool,
  agentSearchAllTool,
} from "./tools/built-in/agent-search.js";
import {
  fileReadTool,
  fileWriteTool,
  fileListTool,
} from "./tools/built-in/file-ops.js";
import { videoTools } from "./tools/built-in/video.js";
import { perplexityStyleTools } from "./tools/built-in/perplexity-search.js";

registry.register(datetimeTool);
registry.register(shellTool);
registry.register(agentListTool);
registry.register(agentAskTool);
registry.register(agentSearchAllTool);
registry.register(fileReadTool);
registry.register(fileWriteTool);
registry.register(fileListTool);

// ── Register Perplexity-Style Search Tools ───────────────────
for (const tool of perplexityStyleTools) {
  registry.register(tool);
}

// ── Register Video Tools ───────────────────────────────────
for (const tool of videoTools) {
  registry.register(tool);
}

// ── Register Voice Tools ────────────────────────────────
import { voiceTools } from "./voice/tools.js";

for (const tool of voiceTools) {
  registry.register(tool);
}

// ── Register Web Tools ───────────────────────────────────
import { webTools } from "./tools/web/index.js";

for (const tool of webTools) {
  registry.register(tool);
}

// ── Register System Tools ─────────────────────────────────
import { systemTools } from "./tools/system/index.js";

for (const tool of systemTools) {
  registry.register(tool);
}

// ── Register Browser Tools ───────────────────────────────
import { browserTools } from "./browser/index.js";

for (const tool of browserTools) {
  registry.register(tool);
}

// ── Register Computer Tools ───────────────────────────────
import { computerTools } from "./computer/index.js";

for (const tool of computerTools) {
  registry.register(tool);
}

// ── Register Sandbox Tools ───────────────────────────────
import { sandboxTools } from "./sandbox/index.js";

for (const tool of sandboxTools) {
  registry.register(tool);
}

// ── Register Creative Tools ───────────────────────────────
import { creativeTools } from "./creative/index.js";

for (const tool of creativeTools) {
  registry.register(tool);
}

// ── Register Cloud Tools ───────────────────────────────
import { cloudTools } from "./cloud/index.js";

for (const tool of cloudTools) {
  registry.register(tool);
}

// ── Register Analytics Tools ───────────────────────────────
import { analyticsTools } from "./analytics/index.js";

for (const tool of analyticsTools) {
  registry.register(tool);
}

// ── Register Collaboration Tools ───────────────────────────────
import { collaborationTools } from "./collaboration/index.js";

for (const tool of collaborationTools) {
  registry.register(tool);
}

// ── Register MCP Tools ───────────────────────────────
import { mcpTools } from "./mcp/index.js";

for (const tool of mcpTools) {
  registry.register(tool);
}

// ── Register Security Tools ───────────────────────────────
import { securityTools } from "./security/index.js";

for (const tool of securityTools) {
  registry.register(tool);
}

// ── Register Scheduler Commands ───────────────────────────────
import { createSchedulerCommands } from "./scheduler/cli.js";

// ── Banner ─────────────────────────────────────────────────
import { showBanner } from "./utils/banner.js";

// ── Register Banner Command ───────────────────────────────
import { bannerCommand } from "./cli/banner-commands.js";

// ── Register Taglines Command ───────────────────────────────
import { taglinesCommand } from "./cli/taglines-commands.js";

// ── CLI Program (must be before addCommand calls) ────────
const program = new Command();

program
  .name("krab")
  .description("🦀 Krab — Lightweight AGI Agent Framework")
  .version("0.1.0");

// Now add subcommands
program.addCommand(createSchedulerCommands());
program.addCommand(gatewayCmd);
program.addCommand(configCmd);
program.addCommand(channelsCmd);
program.addCommand(mcpCmd);
program.addCommand(jobCmd);
program.addCommand(bannerCommand);
program.addCommand(taglinesCommand);

// ── Handle Special Commands ────────────────────────────────
function handleSpecialCommand(input: string, agent: Agent): boolean {
  const cmd = input.trim().toLowerCase();

  if (cmd === "/tools") {
    console.log(pc.cyan("\n📦 Registered Tools:"));
    for (const tool of registry.getAll()) {
      const flags = [
        tool.sideEffect ? pc.yellow("⚡side-effect") : pc.green("📖read-only"),
        tool.requireApproval ? pc.red("🔒approval") : "",
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${pc.bold(tool.name)} — ${tool.description} ${flags}`);
    }
    console.log();
    return true;
  }

  if (cmd === "/memory") {
    const stats = agent.getMemoryStats();
    console.log(pc.cyan("\n🧠 Memory Status:"));
    console.log(`  Total conversations: ${stats.totalConversations}`);
    console.log(`  Total messages: ${stats.totalMessages}`);
    console.log(`  Average messages per conversation: ${stats.averageMessagesPerConversation}`);
    console.log(`  Oldest conversation: ${stats.oldestConversation?.toLocaleDateString() || "None"}`);
    console.log(`  Newest conversation: ${stats.newestConversation?.toLocaleDateString() || "None"}`);
    console.log();
    return true;
  }

  if (cmd === "/clear") {
    agent.clearMemory();
    console.log(pc.green("🧹 Memory cleared!\n"));
    return true;
  }

  if (cmd === "/debug") {
    const config = agent.getConfig();
    console.log(pc.cyan("\n🐛 Debug Info:"));
    console.log(`  Provider: ${config.agents?.defaults?.model?.primary || config.provider?.name || "Not configured"}`);
    console.log(`  Model: ${config.agents?.defaults?.model?.primary || config.provider?.model || "Not configured"}`);
    console.log(`  Max Iterations: ${config.maxIterations || 5}`);
    console.log(`  Max Retries: ${config.maxRetries || 5}`);
    console.log(`  Memory Limit: ${config.memoryLimit || 50}`);
    console.log(`  Debug Mode: ${config.debug || false}`);
    console.log(`  Obsidian Vault: ${config.obsidianVaultPath || "(not set)"}`);
    console.log();
    return true;
  }

  if (cmd === "/help") {
    console.log(pc.cyan("\n📚 Commands:"));
    console.log("  /tools   — List all registered tools");
    console.log("  /memory  — Show memory usage");
    console.log("  /clear   — Clear conversation history");
    console.log("  /debug   — Show config and debug info");
    console.log("  /help    — Show this help");
    console.log("  /exit    — Quit Krab");
    console.log();
    return true;
  }

  return false;
}

// ── Interactive Chat Loop ──────────────────────────────────
async function startChat() {
  showBanner();

  const config = loadConfig();
  const providerName = config.agents?.defaults?.model?.primary || config.provider?.name || "unknown";
  const modelName = config.agents?.defaults?.model?.primary || config.provider?.model || "unknown";
  
  console.log(
    pc.dim(
      `  Provider: ${pc.bold(providerName)} | Model: ${pc.bold(modelName)}`,
    ),
  );
  console.log(pc.dim(`  Tools: ${registry.getNames().join(", ")}`));
  console.log(pc.dim(`  Type /help for commands\n`));

  const agent = new Agent(config);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const input = await rl.question(pc.green("🦀 You: "));
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === "/exit" || trimmed === "/quit") {
      console.log(pc.red("\n👋 Bye from Krab! 🦀\n"));
      break;
    }

    // Handle special commands
    if (trimmed.startsWith("/")) {
      if (handleSpecialCommand(trimmed, agent)) continue;
      console.log(
        pc.yellow(
          `Unknown command: ${trimmed}. Type /help for available commands.\n`,
        ),
      );
      continue;
    }

    // Chat with agent
    console.log(pc.dim("🤔 Thinking..."));
    const startTime = Date.now();
    const response = await agent.chat(trimmed);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(pc.blue(`\n🦀 Krab: `) + response);
    console.log(pc.dim(`  ⏱️ ${elapsed}s\n`));
  }

  rl.close();
}

// ── CLI Program (already defined above) ─────────────────────────

program
  .command("chat")
  .description("Start interactive chat with Krab (classic mode)")
  .action(() => runChat());

program
  .command("tui")
  .description("Start interactive chat with Krab using modern Ink-based TUI")
  .action(() => startTUI());

// gatewayCmd, configCmd, channelsCmd, mcpCmd, jobCmd already added above

program
  .command("onboard")
  .description("Run interactive onboarding wizard")
  .action(() => runOnboarding());

program
  .command("ask")
  .description("Ask Krab a single question")
  .argument("<question...>", "Your question")
  .action(async (questionParts: string[]) => {
    const config = loadConfig();
    const agent = new Agent(config);
    const question = questionParts.join(" ");

    console.log(pc.dim("🤔 Thinking..."));
    const response = await agent.chat(question);
    console.log(pc.blue(`\n🦀 Krab: `) + response + "\n");
  });

// Default action - check if configured
program.action(async () => {
  try {
    // Try to load config
    loadConfig();
    // If successful, start chat
    await startChat();
  } catch (err: any) {
    // No config found - suggest onboarding
    console.log(pc.bgCyan(pc.black(" 🦀 Krab ")));
    console.log("");
    console.log(pc.yellow("⚠️  No configuration found!"));
    console.log("");
    console.log("It looks like this is your first time running Krab.");
    console.log("Run the onboarding wizard to get started:\n");
    console.log(pc.cyan("  krab onboard"));
    console.log("");
  }
});

program.parse();
