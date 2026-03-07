// ============================================================
// 🦀 Krab — CLI (Power Terminal Interface)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "./core/config.js";
import { Agent } from "./core/agent.js";
import { registry } from "./tools/registry.js";
import { pluginLoader } from "./plugins/loader.js";
import { logger } from "./utils/logger.js";
import { GatewayServer } from "./gateway/server.js";
import { runChat } from "./tui/chat.js";
import { runOnboarding, type OnboardingOptions } from "./cli/onboarding.js";
import {
  gatewayCmd,
  configCmd,
  channelsCmd,
  mcpCmd,
  jobCmd,
} from "./cli/gateway-commands.js";
import { hooksCmd } from "./cli/hooks-commands.js";
import { bootstrapCmd } from "./cli/bootstrap-commands.js";
import { sessionCmd } from "./cli/session-commands.js";
import { agentCmd } from "./cli/agent-commands.js";
import { presenceCmd } from "./cli/presence-commands.js";

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
import { sessionTools } from "./tools/built-in/session-tools.js";

for (const tool of voiceTools) {
  registry.register(tool);
}

// ── Register Session Tools ───────────────────────────────
for (const tool of sessionTools) {
  registry.register(tool);
}

// ── Register Memory Tools ────────────────────────────────
import { memoryTools } from "./tools/built-in/memory-tools.js";

for (const tool of memoryTools) {
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

// ── Plugin System ───────────────────────────────────────────────────
import { initializeAgentManager } from "./agent/manager.js";

// ── Initialize Multi-Agent System ───────────────────────────
const config = loadConfig();
initializeAgentManager(config);

// ── Initialize Presence Tracking ────────────────────────────
presenceTracker.updatePresence({
  mode: "cli",
  reason: "self"
});

// ── Register Obsidian Tools ───────────────────────────────────────────────
import { obsidianTools } from "./tools/built-in/obsidian.js";

for (const tool of obsidianTools) {
  registry.register(tool);
}

// ── Register Obsidian Commands ───────────────────────────────
import { obsidianCommand } from "./cli/obsidian-simple.js";
// ── Register Scheduler Commands ───────────────────────────────
import { createSchedulerCommands } from "./scheduler/cli.js";

// ── Banner ─────────────────────────────────────────────────
import { printBanner, printKeyValue } from "./tui/style.js";

// ── Register Banner Command ───────────────────────────────
import { bannerCommand } from "./cli/banner-commands.js";

// ── Register Taglines Command ───────────────────────────────
import { taglinesCommand } from "./cli/taglines-commands.js";

// ── Register New Commands ───────────────────────────────────
import { doctorCommand } from "./cli/doctor.js";
import { securityCommand } from "./cli/security.js";
import { sessionCommand } from "./cli/session.js";
import { agentCommand } from "./cli/agent.js";
import { browserCommand } from "./cli/browser.js";
import { updateCommand } from "./cli/update.js";
import { pairingCommand } from "./cli/pairing.js";
import { modelsCommand } from "./cli/models.js";
import { logsCommand } from "./cli/logs.js";
import { systemCommand } from "./cli/system.js";
import { skillsCommand } from "./cli/skills.js";
import { messageCommand } from "./cli/message.js";
import { setupCommand } from "./cli/setup.js";
import { secretsCommand } from "./cli/secrets.js";
import { daemonCommand } from "./cli/daemon.js";
import { voicecallCommand } from "./cli/voicecall.js";
import { hooksCommand } from "./cli/hooks.js";
import { nodesCommand } from "./cli/nodes.js";
import { pluginsCommand } from "./cli/plugins.js";
import { execApprovalsCommand } from "./cli/exec-approvals.js";

// ── CLI Program (must be before addCommand calls) ────────
const program = new Command();

function applyGlobalRuntimeOptions(opts: {
  dev?: boolean;
  profile?: string;
  logLevel?: string;
}): void {
  if (opts.dev) {
    const devRoot = join(homedir(), ".krab-dev");
    if (!existsSync(devRoot)) {
      mkdirSync(devRoot, { recursive: true });
    }
    process.env.KRAB_PROFILE = "dev";
    process.env.KRAB_STATE_DIR = devRoot;
    process.env.KRAB_DATA_DIR = devRoot;
  }

  if (opts.profile) {
    const profileRoot = join(homedir(), `.krab-${opts.profile}`);
    if (!existsSync(profileRoot)) {
      mkdirSync(profileRoot, { recursive: true });
    }
    process.env.KRAB_PROFILE = opts.profile;
    process.env.KRAB_STATE_DIR = profileRoot;
    process.env.KRAB_DATA_DIR = profileRoot;
  }

  if (opts.logLevel) {
    process.env.KRAB_LOG_LEVEL = opts.logLevel;
  }
}

program
  .name("krab")
  .description("🦀 Krab — Lightweight AGI Agent Framework")
  .option("--dev", "Use isolated ~/.krab-dev state profile")
  .option("--profile <name>", "Use named profile state under ~/.krab-<name>")
  .option(
    "--log-level <level>",
    "Global log level (silent|fatal|error|warn|info|debug|trace)",
  )
  .version("0.1.0");

program.hook("preAction", (cmd) => {
  const opts = cmd.optsWithGlobals() as {
    dev?: boolean;
    profile?: string;
    logLevel?: string;
  };
  applyGlobalRuntimeOptions(opts);
});

program.addHelpText(
  "after",
  `\nExamples:\n  krab models --help\n    Show model command details.\n  krab status --probe\n    Show channel readiness and missing environment keys.\n  krab message ai "สรุประบบล่าสุด"\n    Send one live prompt to the configured provider.\n  krab gateway start --port 18789\n    Start Gateway service on loopback.\n  krab --dev gateway start\n    Run gateway with isolated dev profile/state.\n  krab daemon start\n    Start background gateway service.\n\nDocs: https://docs.openclaw.ai/cli\n`,
);

// Now add subcommands
program.addCommand(createSchedulerCommands());
program.addCommand(gatewayCmd);
program.addCommand(configCmd);
program.addCommand(channelsCmd);
program.addCommand(mcpCmd);
program.addCommand(jobCmd);
program.addCommand(bannerCommand);
program.addCommand(taglinesCommand);
program.addCommand(doctorCommand);
program.addCommand(securityCommand);
program.addCommand(sessionCommand);
program.addCommand(agentCommand);
program.addCommand(browserCommand);
program.addCommand(updateCommand);
program.addCommand(pairingCommand);
program.addCommand(modelsCommand);
program.addCommand(logsCommand);
program.addCommand(systemCommand);
program.addCommand(skillsCommand);
program.addCommand(messageCommand);
program.addCommand(setupCommand);
program.addCommand(secretsCommand);
program.addCommand(daemonCommand);
program.addCommand(nodesCommand);
program.addCommand(pluginsCommand);
program.addCommand(execApprovalsCommand);
program.addCommand(voicecallCommand);
program.addCommand(hooksCmd);
program.addCommand(bootstrapCmd);
program.addCommand(sessionCmd);
program.addCommand(agentCmd);
program.addCommand(presenceCmd);
program.addCommand(obsidianCommand);

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
    console.log(
      `  Average messages per conversation: ${stats.averageMessagesPerConversation}`,
    );
    console.log(
      `  Oldest conversation: ${stats.oldestConversation?.toLocaleDateString() || "None"}`,
    );
    console.log(
      `  Newest conversation: ${stats.newestConversation?.toLocaleDateString() || "None"}`,
    );
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
    console.log(
      `  Provider: ${config.agents?.defaults?.model?.primary || config.provider?.name || "Not configured"}`,
    );
    console.log(
      `  Model: ${config.agents?.defaults?.model?.primary || config.provider?.model || "Not configured"}`,
    );
    console.log(`  Max Iterations: ${config.maxIterations || 5}`);
    console.log(`  Max Retries: ${config.maxRetries || 5}`);
    console.log(`  Memory Limit: ${config.memoryLimit || 50}`);
    console.log(`  Debug Mode: ${config.debug || false}`);
    console.log(`  Obsidian Vault: ${config.obsidianVaultPath || "(not set)"}`);
    console.log();
    return true;
  }

  if (cmd === "/plugins") {
    const stats = pluginLoader.count();
    console.log(pc.cyan("\n🧩 Plugins:"));
    if (stats.total === 0) {
      console.log("  No plugins installed.");
      console.log(
        pc.dim("  Install plugins to ~/.krab/plugins/ or ./krab-plugins/"),
      );
    } else {
      for (const plugin of pluginLoader.list()) {
        const status =
          plugin.status === "loaded"
            ? pc.green("✅")
            : plugin.status === "error"
              ? pc.red("❌")
              : pc.yellow("⏸️");
        const tools =
          plugin.registeredTools.length > 0
            ? pc.dim(` (tools: ${plugin.registeredTools.join(", ")})`)
            : "";
        console.log(
          `  ${status} ${pc.bold(plugin.manifest.name)} v${plugin.manifest.version}${tools}`,
        );
        if (plugin.error) {
          console.log(`     ${pc.red(plugin.error)}`);
        }
      }
      console.log(
        pc.dim(
          `\n  Total: ${stats.loaded} loaded, ${stats.error} errors, ${stats.disabled} disabled`,
        ),
      );
    }
    console.log();
    return true;
  }

  if (cmd === "/help") {
    console.log(pc.cyan("\n📚 Commands:"));
    console.log("  /plugins — Show loaded plugins");
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
// Now handled by runChat() imported from src/tui/chat.ts
// ───────────────────────────────────────────────────────────

// ── CLI Program (already defined above) ─────────────────────────

program
  .command("chat")
  .description("Start interactive chat with Krab (classic mode)")
  .action(() => runChat());

program.command("tui").description("Alias for interactive chat TUI").action(() => runChat());

function normalizeOnboardOptions(options: any): OnboardingOptions {
  const channels = typeof options.channels === "string"
    ? options.channels
        .split(",")
        .map((v: string) => v.trim())
        .filter(Boolean)
    : undefined;

  return {
    mode: options.mode,
    flow: options.flow,
    workspace: options.workspace,
    nonInteractive: options.nonInteractive,
    acceptRisk: options.acceptRisk,
    gatewayPort: options.gatewayPort ? parseInt(String(options.gatewayPort), 10) : undefined,
    gatewayBind: options.gatewayBind,
    gatewayAuth: options.gatewayAuth,
    gatewayToken: options.gatewayToken,
    remoteUrl: options.remoteUrl,
    remoteToken: options.remoteToken,
    provider: options.provider,
    model: options.model,
    apiKey: options.apiKey,
    channels,
    skipChannels: options.skipChannels,
    skipSkills: options.skipSkills,
    skipHealth: options.skipHealth,
    installDaemon: options.installDaemon,
  };
}

function applyOnboardFlags(cmd: Command): Command {
  return cmd
    .option("--mode <mode>", "Onboarding mode (local|remote)", "local")
    .option("--flow <flow>", "Wizard flow (quickstart|advanced)", "quickstart")
    .option("--workspace <path>", "Workspace directory override")
    .option("--non-interactive", "Run onboarding without prompts")
    .option("--accept-risk", "Acknowledge risk for non-interactive runs")
    .option("--gateway-port <port>", "Gateway port (local mode)")
    .option("--gateway-bind <bind>", "Gateway bind (loopback|lan)")
    .option("--gateway-auth <auth>", "Gateway auth (token|none)")
    .option("--gateway-token <token>", "Gateway token value")
    .option("--remote-url <url>", "Remote gateway URL (remote mode)")
    .option("--remote-token <token>", "Remote gateway token (remote mode)")
    .option(
      "--provider <provider>",
      "Provider (google|openai|anthropic|openrouter|kilocode|ollama)",
    )
    .option("--model <id>", "Default model ID")
    .option("--api-key <key>", "Provider API key/base URL (for ollama)")
    .option("--channels <list>", "Comma-separated channels (telegram,whatsapp,discord,line,signal,imessage)")
    .option("--skip-channels", "Skip channels configuration")
    .option("--skip-skills", "Skip skills step")
    .option("--skip-health", "Skip health check step")
    .option("--install-daemon", "Enable daemon in onboarding output config");
}

applyOnboardFlags(
  program
    .command("configure")
    .description("Alias for onboarding wizard"),
).action(async (options) => runOnboarding(normalizeOnboardOptions(options)));

program
  .command("health")
  .description("Quick gateway health check")
  .action(async () => {
    try {
      const response = await fetch("http://127.0.0.1:18789/healthz", {
        method: "GET",
      });
      if (response.ok) {
        console.log(pc.green("✅ Gateway health: OK"));
      } else {
        console.log(pc.yellow(`⚠️  Gateway health: ${response.status}`));
      }
    } catch {
      console.log(pc.red("❌ Gateway health: unavailable"));
    }
  });

program
  .command("dashboard")
  .description("Show Control UI URL")
  .action(() => {
    const url = "http://127.0.0.1:18789/krab";
    console.log(pc.cyan(`Control UI: ${url}`));
  });

program
  .command("sessions")
  .description("Alias for 'session list'")
  .action(() => {
    execFileSync(process.execPath, [process.argv[1], "session", "list"], {
      stdio: "inherit",
    });
  });

const channelsTopCommand = new Command("channels")
  .description("Manage connected chat channels")
  .addCommand(
    new Command("status")
      .description("Check channel readiness")
      .option("--probe", "Probe channel env readiness")
      .action((options) => {
        const args = [process.argv[1], "status"];
        if (options.probe) args.push("--probe");
        execFileSync(process.execPath, args, {
          stdio: "inherit",
        });
      }),
  )
  .addCommand(
    new Command("login")
      .description("Channel login guidance")
      .action(() => {
        console.log(pc.cyan("Use channel-specific setup via onboarding:"));
        console.log(pc.dim("  krab onboard"));
      }),
  );

program.addCommand(channelsTopCommand);

// gatewayCmd, configCmd, channelsCmd, mcpCmd, jobCmd already added above

applyOnboardFlags(
  program
    .command("onboard")
    .description("Run onboarding wizard"),
).action(async (options) => runOnboarding(normalizeOnboardOptions(options)));

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
    await runChat();
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

// ── Load Plugins (dynamic, no core edits needed) ───────────────
async function loadPlugins() {
  try {
    const loaded = await pluginLoader.loadAll();
    const stats = pluginLoader.count();
    if (stats.total > 0) {
      logger.info(
        `[🧩 Plugins] ${stats.loaded} loaded, ${stats.error} errors, ${stats.disabled} disabled`,
      );
    }
  } catch (err) {
    logger.warn(`[Plugins] Failed to load plugins: ${err}`);
  }
}

// Load plugins then parse CLI
loadPlugins().then(() => {
  program.parse();
});
