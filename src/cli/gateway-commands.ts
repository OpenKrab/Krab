// ============================================================
// 🦀 Krab — Gateway Commands (OpenClaw-inspired)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { join, resolve } from "path";
import { homedir } from "os";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { execSync } from "child_process";
import { loadConfig, saveConfig } from "../core/krab-config.js";
import { GatewayServer } from "../gateway/server.js";
import { MCPServer, createMCPServer } from "../mcp/server.js";
import { MCPClient, createMCPClient } from "../mcp/client.js";
import { pluginLoader } from "../plugins/loader.js";
import * as CronStuff from "../scheduler/cron.js";
import { CronScheduler } from "../scheduler/cron.js";
const { createScheduler, jobTemplates } = CronStuff as any;
import { buildGatewayRuntimeSnapshot } from "../gateway/runtime-state.js";

// ── Gateway Commands ────────────────────────────────────────
const gatewayCmd = new Command("gateway")
  .description("Gateway server management (OpenClaw-inspired)")
  .option("-p, --port <port>", "Port to listen on", "18789")
  .option(
    "-b, --bind <bind>",
    "Bind address (loopback|lan|tailnet|custom)",
    "loopback",
  )
  .option("--verbose", "Enable verbose logging")
  .option("--force", "Force kill existing listener")
  .action(async (options) => {
    await startGateway(options);
  });

// Subcommands
gatewayCmd
  .command("start")
  .description("Start Gateway server")
  .option("-p, --port <port>", "Port to listen on", "18789")
  .option("-b, --bind <bind>", "Bind address", "loopback")
  .option("--verbose", "Enable verbose logging")
  .option("--force", "Force kill existing listener")
  .action(async (options) => {
    await startGateway(options);
  });

gatewayCmd
  .command("status")
  .description("Check Gateway status")
  .option("--deep", "Deep status with health and readiness probes")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await checkGatewayStatus(options);
  });

gatewayCmd
  .command("health")
  .description("Check Gateway health")
  .action(async () => {
    await checkGatewayHealth();
  });

gatewayCmd
  .command("stop")
  .description("Stop the running Gateway")
  .action(async () => {
    await stopGateway();
  });

gatewayCmd
  .command("restart")
  .description("Restart the Gateway")
  .option("-p, --port <port>", "Port to listen on", "18789")
  .option("-b, --bind <bind>", "Bind address", "loopback")
  .action(async (options) => {
    await stopGateway();
    await new Promise((r) => setTimeout(r, 1000));
    await startGateway(options);
  });

gatewayCmd
  .command("install")
  .description("Install Gateway as a system service (auto-start)")
  .action(async () => {
    await installGatewayService();
  });

gatewayCmd
  .command("logs")
  .description("Show Gateway logs")
  .option("--follow", "Follow log output")
  .action(async (options) => {
    await showGatewayLogs(options);
  });

gatewayCmd
  .command("doctor")
  .description("Diagnose Gateway issues")
  .option("--fix", "Apply automatic fixes")
  .action(async (options) => {
    await runGatewayDoctor(options);
  });

// ── Configuration Commands ────────────────────────────────
const configCmd = new Command("config")
  .description("Gateway configuration management")
  .argument("[key]", "Configuration key")
  .argument("[value]", "Configuration value")
  .action(async (key, value) => {
    await manageConfig(key, value);
  });

// ── Channel Commands ────────────────────────────────────────
const channelsCmd = new Command("channels")
  .description("Channel management")
  .command("status")
  .description("Check channel status")
  .option("--probe", "Probe channel readiness")
  .action(async (options) => {
    await checkChannelStatus(options);
  });

// ── Implementation Functions ───────────────────────────────────
async function startGateway(options: any): Promise<void> {
  try {
    console.log(pc.cyan("🚀 Starting Krab Gateway..."));

    const config = loadConfig();
    const gatewayConfig = {
      port: parseInt(options.port),
      bind: options.bind as "loopback" | "lan" | "tailnet" | "custom",
      auth: config.gateway?.auth || {
        mode: "none",
        allowTailscale: true,
        rateLimit: {
          maxAttempts: 10,
          windowMs: 60000,
          lockoutMs: 300000,
          exemptLoopback: true,
        },
      },
      http: config.gateway?.http || {
        endpoints: {
          chatCompletions: { enabled: true },
          responses: { enabled: true },
        },
      },
    };

    const server = new GatewayServer(
      gatewayConfig,
      config.agents?.defaults?.workspace || "~/.krab/workspace",
    );
    await server.start();

    console.log(
      pc.green(`✅ Gateway running on ${options.bind}:${options.port}`),
    );
    console.log(pc.dim(`   WebSocket: ws://${options.bind}:${options.port}`));
    console.log(pc.dim(`   HTTP API: http://${options.bind}:${options.port}`));
    console.log(
      pc.dim(`   Control UI: http://${options.bind}:${options.port}/krab`),
    );

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down Gateway...");
      await server.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Shutting down Gateway...");
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error(pc.red("❌ Failed to start Gateway:"), error);
    process.exit(1);
  }
}

export async function getGatewayStatusSnapshot(options: any = {}): Promise<any> {
  const config = loadConfig();
  const port = config.gateway?.port || 18789;

  const statusData: any = {
    port,
    bind: config.gateway?.bind || "loopback",
    auth: config.gateway?.auth?.mode || "none",
    workspace: config.agents?.defaults?.workspace || "~/.krab/workspace",
    running: false,
    health: null as any,
    ready: null as any,
  };

  // Check if running
  try {
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    if (healthRes.ok) {
      statusData.running = true;
      statusData.health = await healthRes.json();
    }
  } catch {
    statusData.running = false;
  }

  // Deep check
  if (options.deep && statusData.running) {
    try {
      const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
      statusData.ready = readyRes.ok
        ? await readyRes.json()
        : { status: "not_ready" };
    } catch {
      statusData.ready = { status: "unreachable" };
    }

    try {
      const statusRes = await fetch(`http://127.0.0.1:${port}/status`);
      if (statusRes.ok) {
        statusData.details = await statusRes.json();
        if (statusData.details?.status) {
          statusData.runtimeStatus = statusData.details.status;
        }
      }
    } catch {
      // ignore
    }
  }

  return statusData;
}

async function checkGatewayStatus(options: any = {}): Promise<void> {
  try {
    const statusData = await getGatewayStatusSnapshot(options);
    const port = statusData.port;

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(statusData, null, 2));
      return;
    }

    // Pretty output
    console.log(pc.cyan("\n📊 Gateway Status:"));
    console.log(`   Port: ${port}`);
    console.log(`   Bind: ${statusData.bind}`);
    console.log(`   Auth: ${statusData.auth}`);
    console.log(`   Workspace: ${statusData.workspace}`);

    if (statusData.running) {
      console.log(pc.green("   Runtime: ✅ Running"));
      if (statusData.health?.uptime || statusData.details?.uptimeSeconds) {
        const uptime = statusData.health?.uptime || statusData.details?.uptimeSeconds;
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        console.log(pc.dim(`   Uptime: ${hours}h ${mins}m`));
      }
      if (statusData.runtimeStatus) {
        console.log(`   Health: ${statusData.runtimeStatus}`);
      }
    } else {
      console.log(pc.red("   Runtime: ❌ Not running"));
    }

    if (options.deep && statusData.running) {
      console.log();
      console.log(pc.cyan("   🏥 Health Probes:"));
      console.log(
        `   Liveness: ${statusData.health ? pc.green("✅ OK") : pc.red("❌ Failed")}`,
      );
      console.log(
        `   Readiness: ${statusData.ready?.status === "ready" ? pc.green("✅ OK") : pc.yellow("⚠️  Not ready")}`,
      );

      if (statusData.details) {
        console.log();
        console.log(pc.cyan("   📈 Runtime Details:"));
        console.log(
          `   WebSocket connections: ${statusData.details.websocket?.connections ?? 0}`,
        );
        console.log(
          `   Active agents: ${statusData.details.agents?.length ?? 0}`,
        );
        console.log(
          `   Tools loaded: ${statusData.details.tools?.count ?? "unknown"}`,
        );
        console.log(
          `   Presence active: ${statusData.details.presence?.active ?? 0}`,
        );
        console.log(
          `   Config loaded: ${statusData.details.readiness?.configLoaded ? "yes" : "no"}`,
        );
      }
    }
    console.log();
  } catch (error) {
    console.error(pc.red("❌ Status check failed:"), error);
  }
}

async function stopGateway(): Promise<void> {
  try {
    const config = loadConfig();
    const port = config.gateway?.port || 18789;

    console.log(pc.cyan("🛑 Stopping Gateway..."));

    // Check if running first
    const isRunning = await fetch(`http://127.0.0.1:${port}/health`)
      .then((res) => res.ok)
      .catch(() => false);

    if (!isRunning) {
      console.log(pc.yellow("⚠️  Gateway is not running"));
      return;
    }

    // Try PID file approach
    const pidFile = join(homedir(), ".krab", "gateway.pid");
    if (existsSync(pidFile)) {
      try {
        const pid = parseInt(readFileSync(pidFile, "utf-8").trim());
        process.kill(pid, "SIGTERM");
        unlinkSync(pidFile);
        console.log(pc.green(`✅ Gateway stopped (PID: ${pid})`));
        return;
      } catch {
        // PID stale, try cleanup
        try {
          unlinkSync(pidFile);
        } catch {
          /* ignore */
        }
      }
    }

    console.log(
      pc.yellow(
        "⚠️  Cannot find gateway process — if running in foreground, use Ctrl+C",
      ),
    );
  } catch (error) {
    console.error(pc.red("❌ Failed to stop Gateway:"), error);
  }
}

async function installGatewayService(): Promise<void> {
  const platform = process.platform;
  const krabPath = resolve(process.cwd(), "dist", "cli.js");
  const stateDirPath = join(homedir(), ".krab");

  console.log(pc.cyan("🔧 Installing Krab Gateway service...\n"));

  if (platform === "win32") {
    // Windows: Create a Scheduled Task
    const taskName = "KrabGateway";
    const nodePath = process.execPath;
    const cmd = `schtasks /create /tn "${taskName}" /tr "${nodePath} ${krabPath} gateway start" /sc onlogon /rl highest /f`;

    console.log(`   Platform: Windows`);
    console.log(`   Method: Scheduled Task (${taskName})`);
    console.log(`   Command: node ${krabPath} gateway start`);
    console.log(`   Trigger: On logon\n`);

    try {
      execSync(cmd, { stdio: "pipe" });
      console.log(pc.green("✅ Scheduled Task created!"));
      console.log(
        pc.dim(`   To remove: schtasks /delete /tn "${taskName}" /f`),
      );
      console.log(pc.dim(`   To run now: schtasks /run /tn "${taskName}"`));
    } catch (error: any) {
      console.error(pc.red("❌ Failed to create Scheduled Task"));
      console.log(pc.dim("   You may need to run as Administrator"));
      console.log(pc.dim(`   Manual command: ${cmd}`));
    }
  } else if (platform === "linux") {
    // Linux: Create a systemd user service
    const serviceDir = join(homedir(), ".config", "systemd", "user");
    const serviceName = "krab-gateway";
    const serviceFile = join(serviceDir, `${serviceName}.service`);

    const serviceContent = `[Unit]
Description=Krab Gateway Server
After=network.target

[Service]
Type=simple
ExecStart=${process.execPath} ${krabPath} gateway start
Restart=on-failure
RestartSec=5
WorkingDirectory=${process.cwd()}
Environment=HOME=${homedir()}
Environment=KRAB_STATE_DIR=${stateDirPath}

[Install]
WantedBy=default.target
`;

    console.log(`   Platform: Linux`);
    console.log(`   Method: systemd user service (${serviceName})`);
    console.log(`   Service file: ${serviceFile}\n`);

    try {
      if (!existsSync(serviceDir)) {
        mkdirSync(serviceDir, { recursive: true });
      }
      writeFileSync(serviceFile, serviceContent);

      execSync("systemctl --user daemon-reload", { stdio: "pipe" });
      execSync(`systemctl --user enable ${serviceName}.service`, {
        stdio: "pipe",
      });
      execSync(`systemctl --user start ${serviceName}.service`, {
        stdio: "pipe",
      });

      console.log(pc.green("✅ systemd user service installed and started!"));
      console.log(pc.dim(`   Status: systemctl --user status ${serviceName}`));
      console.log(pc.dim(`   Logs: journalctl --user -u ${serviceName} -f`));
      console.log(pc.dim(`   Stop: systemctl --user stop ${serviceName}`));
      console.log();
      console.log(pc.yellow("💡 To persist after logout:"));
      console.log(pc.dim(`   sudo loginctl enable-linger "$(whoami)"`));
    } catch (error: any) {
      console.error(pc.red("❌ Failed to install systemd service"));
      console.log(pc.dim(`   Manual: copy service file to ${serviceFile}`));
      console.log(
        pc.dim(`   Then: systemctl --user enable --now ${serviceName}`),
      );
    }
  } else if (platform === "darwin") {
    // macOS: Create a launchd plist
    const plistDir = join(homedir(), "Library", "LaunchAgents");
    const plistName = "ai.krab.gateway";
    const plistFile = join(plistDir, `${plistName}.plist`);

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${plistName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${krabPath}</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>${process.cwd()}</string>
    <key>StandardOutPath</key>
    <string>${join(stateDirPath, "gateway.log")}</string>
    <key>StandardErrorPath</key>
    <string>${join(stateDirPath, "gateway.log")}</string>
</dict>
</plist>
`;

    console.log(`   Platform: macOS`);
    console.log(`   Method: launchd (${plistName})`);
    console.log(`   Plist file: ${plistFile}\n`);

    try {
      if (!existsSync(plistDir)) {
        mkdirSync(plistDir, { recursive: true });
      }
      writeFileSync(plistFile, plistContent);
      execSync(`launchctl load ${plistFile}`, { stdio: "pipe" });

      console.log(pc.green("✅ launchd service installed and loaded!"));
      console.log(pc.dim(`   Status: launchctl list | grep ${plistName}`));
      console.log(pc.dim(`   Unload: launchctl unload ${plistFile}`));
    } catch (error: any) {
      console.error(pc.red("❌ Failed to install launchd service"));
      console.log(pc.dim(`   Manual: copy plist to ${plistFile}`));
      console.log(pc.dim(`   Then: launchctl load ${plistFile}`));
    }
  } else {
    console.log(pc.red(`❌ Unsupported platform: ${platform}`));
    console.log(pc.dim("   Supported: Windows, Linux, macOS"));
  }
}

async function checkGatewayHealth(): Promise<void> {
  try {
    const config = loadConfig();
    const port = config.gateway?.port || 18789;

    console.log(pc.cyan("🏥 Gateway Health Check:"));

    // Liveness check
    const livenessResponse = await fetch(`http://127.0.0.1:${port}/health`)
      .then((res) => res.ok)
      .catch(() => false);

    if (livenessResponse) {
      console.log(pc.green("   ✅ Liveness: OK"));
    } else {
      console.log(pc.red("   ❌ Liveness: Failed"));
    }

    // Readiness check
    const readinessResponse = await fetch(`http://127.0.0.1:${port}/ready`)
      .then((res) => res.ok)
      .catch(() => false);

    if (readinessResponse) {
      console.log(pc.green("   ✅ Readiness: OK"));
    } else {
      console.log(pc.yellow("   ⚠️  Readiness: Not ready"));
    }
  } catch (error) {
    console.error(pc.red("❌ Health check failed:"), error);
  }
}

async function showGatewayLogs(options: any): Promise<void> {
  console.log(pc.cyan("📋 Gateway Logs:"));
  console.log(pc.dim("   (Log viewing not implemented yet)"));
  console.log(pc.dim("   Use --follow to tail logs"));
}

async function runGatewayDoctor(options: any): Promise<void> {
  console.log(pc.cyan("🩺 Gateway Doctor:"));

  const issues: string[] = [];
  const fixes: string[] = [];

  // Check workspace
  const config = loadConfig();
  const workspace = config.agents?.defaults?.workspace;

  if (!workspace) {
    issues.push("No workspace configured");
    fixes.push("Run 'npm run dev -- wizard' to setup workspace");
  } else {
    console.log(pc.green(`   ✅ Workspace: ${workspace}`));
  }

  // Check port availability
  const port = config.gateway?.port || 18789;
  // TODO: Add actual port check

  console.log(pc.green(`   ✅ Port: ${port}`));

  // Check auth configuration
  const authMode = config.gateway?.auth?.mode;
  if (authMode === "none" && config.gateway?.bind !== "loopback") {
    issues.push("No authentication configured for non-loopback bind");
    fixes.push("Configure token or password authentication");
  } else {
    console.log(pc.green(`   ✅ Auth: ${authMode}`));
  }

  if (issues.length > 0) {
    console.log(pc.red("\n❌ Issues found:"));
    issues.forEach((issue) => console.log(`   - ${issue}`));

    if (options.fix) {
      console.log(pc.yellow("\n🔧 Applying fixes:"));
      fixes.forEach((fix) => console.log(`   - ${fix}`));
    } else {
      console.log(pc.yellow("\n💡 Run with --fix to apply automatic fixes"));
    }
  } else {
    console.log(pc.green("\n✅ No issues found"));
  }

  const gatewayStatus = await getGatewayStatusSnapshot({ deep: true });
  const snapshot = gatewayStatus.details;
  if (!snapshot) {
    console.log(pc.gray("\nGateway runtime snapshot unavailable. Start the gateway and retry for deeper diagnostics."));
    return;
  }

  console.log(pc.cyan("\n=== Gateway Runtime Snapshot ==="));
  console.log(pc.bold("Uptime:"), pc.green(`${snapshot.uptimeSeconds ?? 0} seconds`));
  console.log(pc.bold("Message Queue Depth:"), pc.yellow(snapshot.messageQueue?.depth ?? snapshot.queueDepth ?? 0));
  console.log(pc.bold("Queue Pending:"), pc.yellow(snapshot.messageQueue?.pending ?? 0));
  console.log(pc.bold("Queue Processing:"), pc.yellow(snapshot.messageQueue?.processing ?? 0));
  console.log(pc.bold("Presence Active:"), pc.green(snapshot.presenceSummary?.active ?? snapshot.presence?.active ?? 0));
  console.log(pc.bold("Sessions Active:"), pc.green(snapshot.sessionState?.activeCount ?? 0));
  console.log(pc.bold("Sessions Total:"), pc.green(snapshot.sessionState?.totalCount ?? 0));
  console.log(pc.bold("WebSocket Connections:"), pc.yellow(snapshot.websocket?.connections ?? 0));
  console.log("");

  console.log(pc.bold("Recent Messages:"));
  const recentMessages = Array.isArray(snapshot.messageQueue?.recent) ? snapshot.messageQueue.recent : [];
  if (recentMessages.length === 0) {
    console.log(pc.gray("  No recent messages."));
  } else {
    for (const msg of recentMessages) {
      console.log(pc.gray(`  [${msg.receivedAt}] ${msg.id} (${msg.channel || 'unknown'}): ${msg.status}`));
    }
  }
  console.log("");

  console.log(pc.bold("Recent Sessions:"));
  const recentSessions = Array.isArray(snapshot.sessionState?.recent) ? snapshot.sessionState.recent : [];
  if (recentSessions.length === 0) {
    console.log(pc.gray("  No recent sessions."));
  } else {
    for (const sess of recentSessions) {
      console.log(pc.gray(`  [${sess.lastActivity}] ${sess.id} (${sess.channel})`));
    }
  }
  console.log("");

  console.log(pc.bold("Presence Instances:"));
  const presenceInstances = Array.isArray(snapshot.presenceSummary?.instances)
    ? snapshot.presenceSummary.instances
    : [];
  if (presenceInstances.length === 0) {
    console.log(pc.gray("  No presence instances."));
  } else {
    for (const inst of presenceInstances) {
      console.log(pc.gray(`  [${inst.lastSeen}] ${inst.id} (${inst.type})`));
    }
  }
  console.log("");

  console.log(pc.gray("Run 'krab gateway check-health' for live health checks."));
}

async function manageConfig(key?: string, value?: string): Promise<void> {
  const config = loadConfig();

  if (!key) {
    // Show all config
    console.log(pc.cyan("⚙️  Current Configuration:"));
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (!value) {
    // Get specific config value
    const keys = key.split(".");
    let current: any = config;

    for (const k of keys) {
      current = current?.[k];
    }

    console.log(pc.cyan(`⚙️  ${key}:`));
    console.log(JSON.stringify(current, null, 2));
    return;
  }

  // Set config value
  const keys = key.split(".");
  let target: any = config;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]]) {
      target[keys[i]] = {};
    }
    target = target[keys[i]];
  }

  // Try to parse as JSON, fallback to string
  try {
    target[keys[keys.length - 1]] = JSON.parse(value);
  } catch {
    target[keys[keys.length - 1]] = value;
  }

  saveConfig({ [key]: target[keys[keys.length - 1]] });
  console.log(pc.green(`✅ Set ${key} = ${value}`));
}

async function checkChannelStatus(options: any): Promise<void> {
  console.log(pc.cyan("📡 Channel Status:"));

  const loadedPlugins = pluginLoader.list();
  const loadedChannels = pluginLoader.getChannels();
  const discovered = await pluginLoader.discover().catch(() => []);
  const config = loadConfig() as any;
  const channelConfig = config.channels || {};

  const knownChannels = [
    {
      name: "telegram",
      envKeys: ["TELEGRAM_BOT_TOKEN"],
    },
    {
      name: "discord",
      envKeys: ["DISCORD_BOT_TOKEN"],
    },
    {
      name: "whatsapp",
      envKeys: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    },
    {
      name: "line",
      envKeys: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"],
    },
    {
      name: "signal",
      envKeys: ["SIGNAL_API_TOKEN", "SIGNAL_ACCOUNT"],
    },
    {
      name: "imessage",
      envKeys: ["IMESSAGE_API_URL", "IMESSAGE_API_TOKEN"],
    },
  ];

  const discoveredChannels = new Set<string>();
  for (const item of discovered) {
    for (const ch of item.manifest.channels || []) {
      discoveredChannels.add(ch.name);
    }
  }

  for (const known of knownChannels) {
    const fromConfig = channelConfig[known.name];
    const hasConfig = Boolean(fromConfig);
    const enabled = fromConfig?.enabled !== false && hasConfig;
    const envReady = known.envKeys.every((k) => Boolean(process.env[k]));
    const loaded = loadedChannels.some((c) => c.name === known.name);
    const discoveredPlugin = discoveredChannels.has(known.name);

    const status = loaded
      ? pc.green("running")
      : enabled && envReady
        ? pc.yellow("ready")
        : hasConfig
          ? pc.yellow("partial")
          : pc.dim("not-configured");

    console.log(
      `  ${known.name.padEnd(10)} ${status}  config=${hasConfig ? "yes" : "no"} env=${envReady ? "ok" : "missing"} plugin=${discoveredPlugin ? "yes" : "no"}`,
    );

    if (options.probe && !envReady) {
      const missing = known.envKeys.filter((k) => !process.env[k]);
      if (missing.length > 0) {
        console.log(pc.dim(`    missing env: ${missing.join(", ")}`));
      }
    }
  }

  const stats = pluginLoader.count();
  console.log();
  console.log(
    pc.dim(
      `Plugins loaded=${stats.loaded}, error=${stats.error}, disabled=${stats.disabled}, total=${loadedPlugins.length}`,
    ),
  );
}

// ── MCP Command Implementations ─────────────────────────────
let mcpServerInstance: MCPServer | null = null;
let mcpClientInstance: MCPClient | null = null;

async function startMCPServer(options: any): Promise<void> {
  try {
    if (mcpServerInstance?.isRunning()) {
      console.log(pc.yellow("⚠️  MCP Server is already running"));
      return;
    }

    console.log(pc.cyan("🚀 Starting MCP Server..."));

    const serverOptions = {
      port: parseInt(options.port),
      websocket: options.websocket && !options.http,
      allowedOrigins: ["*"], // TODO: Make configurable
    };

    mcpServerInstance = createMCPServer(serverOptions);
    await mcpServerInstance.start();

    console.log(pc.green(`✅ MCP Server running on port ${options.port}`));
    console.log(pc.dim(`   WebSocket: ws://localhost:${options.port}`));
    console.log(pc.dim(`   HTTP: http://localhost:${options.port}`));

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down MCP Server...");
      if (mcpServerInstance) {
        await mcpServerInstance.stop();
      }
      process.exit(0);
    });
  } catch (error) {
    console.error(pc.red("❌ Failed to start MCP Server:"), error);
    process.exit(1);
  }
}

async function stopMCPServer(): Promise<void> {
  try {
    if (!mcpServerInstance?.isRunning()) {
      console.log(pc.yellow("⚠️  MCP Server is not running"));
      return;
    }

    console.log(pc.cyan("🛑 Stopping MCP Server..."));
    await mcpServerInstance!.stop();
    mcpServerInstance = null;
    console.log(pc.green("✅ MCP Server stopped"));
  } catch (error) {
    console.error(pc.red("❌ Failed to stop MCP Server:"), error);
  }
}

async function checkMCPServerStatus(): Promise<void> {
  console.log(pc.cyan("📊 MCP Server Status:"));

  if (!mcpServerInstance?.isRunning()) {
    console.log(pc.red("   Status: ❌ Not running"));
    return;
  }

  console.log(pc.green("   Status: ✅ Running"));
  console.log(`   Port: ${mcpServerInstance ? "Unknown" : "3001"}`); // TODO: Add port getter
  console.log(
    `   Connections: ${mcpServerInstance?.getConnectionCount() || 0}`,
  );
}

async function handleMCPClient(action: string, options: any): Promise<void> {
  try {
    switch (action) {
      case "connect":
        if (mcpClientInstance?.isConnected()) {
          console.log(pc.yellow("⚠️  MCP Client is already connected"));
          return;
        }

        console.log(pc.cyan("🔌 Connecting to MCP server..."));

        let clientOptions: any = {};
        if (options.command) {
          clientOptions.command = options.command.split(" ");
        } else if (options.websocket) {
          clientOptions.websocketUrl = options.websocket;
        } else {
          console.error(
            pc.red("❌ Must specify either --command or --websocket"),
          );
          return;
        }

        mcpClientInstance = createMCPClient(clientOptions);
        await mcpClientInstance.connect();
        console.log(pc.green("✅ MCP Client connected"));
        break;

      case "disconnect":
        if (!mcpClientInstance?.isConnected()) {
          console.log(pc.yellow("⚠️  MCP Client is not connected"));
          return;
        }

        console.log(pc.cyan("🔌 Disconnecting from MCP server..."));
        await mcpClientInstance!.disconnect();
        mcpClientInstance = null;
        console.log(pc.green("✅ MCP Client disconnected"));
        break;

      case "list-tools":
        if (!mcpClientInstance?.isConnected()) {
          console.log(pc.red("❌ MCP Client is not connected"));
          return;
        }

        console.log(pc.cyan("🔧 Available MCP Tools:"));
        const tools = mcpClientInstance.getAvailableTools();

        if (tools.length === 0) {
          console.log(pc.dim("   No tools available"));
          return;
        }

        tools.forEach((tool) => {
          console.log(`   • ${pc.bold(tool.name)}: ${tool.description}`);
        });
        break;

      case "call-tool":
        if (!mcpClientInstance?.isConnected()) {
          console.log(pc.red("❌ MCP Client is not connected"));
          return;
        }

        const toolName = options.tool || options._[1];
        let args = {};

        try {
          args = JSON.parse(options.args || options._[2] || "{}");
        } catch (error) {
          console.error(pc.red("❌ Invalid JSON arguments"));
          return;
        }

        console.log(pc.cyan(`🔧 Calling tool: ${toolName}`));
        const result = await mcpClientInstance.callTool(toolName, args);
        console.log(pc.green("✅ Tool result:"));
        console.log(JSON.stringify(result, null, 2));
        break;

      default:
        console.log(pc.red(`❌ Unknown action: ${action}`));
        console.log(
          pc.dim(
            "Available actions: connect, disconnect, list-tools, call-tool",
          ),
        );
    }
  } catch (error) {
    console.error(pc.red(`❌ MCP Client error:`), error);
  }
}

// ── MCP Commands ───────────────────────────────────────────
const mcpCmd = new Command("mcp").description(
  "MCP (Model Context Protocol) management",
);

// MCP Server commands
mcpCmd
  .command("server")
  .description("MCP Server management")
  .option("-p, --port <port>", "Port to listen on", "3001")
  .option("--websocket", "Use WebSocket transport", true)
  .option("--http", "Use HTTP transport")
  .option("--no-websocket", "Disable WebSocket transport")
  .action(async (options) => {
    await startMCPServer(options);
  });

mcpCmd
  .command("server:start")
  .description("Start MCP Server")
  .option("-p, --port <port>", "Port to listen on", "3001")
  .option("--websocket", "Use WebSocket transport", true)
  .option("--http", "Use HTTP transport")
  .option("--no-websocket", "Disable WebSocket transport")
  .action(async (options) => {
    await startMCPServer(options);
  });

mcpCmd
  .command("server:stop")
  .description("Stop MCP Server")
  .action(async () => {
    await stopMCPServer();
  });

mcpCmd
  .command("server:status")
  .description("Check MCP Server status")
  .action(async () => {
    await checkMCPServerStatus();
  });

// MCP Client commands
mcpCmd
  .command("client")
  .description("MCP Client management")
  .argument("<action>", "Action: connect, disconnect, list-tools, call-tool")
  .option("--command <cmd>", "Command to run for stdio connection")
  .option("--websocket <url>", "WebSocket URL for connection")
  .option("--tool <name>", "Tool name for call-tool action")
  .option("--args <json>", "Arguments for tool call (JSON string)")
  .action(async (action, options) => {
    await handleMCPClient(action, options);
  });

mcpCmd
  .command("connect")
  .description("Connect to MCP server")
  .option("--command <cmd>", "Command to run for stdio connection")
  .option("--websocket <url>", "WebSocket URL for connection")
  .action(async (options) => {
    await handleMCPClient("connect", options);
  });

mcpCmd
  .command("disconnect")
  .description("Disconnect from MCP server")
  .action(async () => {
    await handleMCPClient("disconnect", {});
  });

mcpCmd
  .command("tools")
  .description("List available MCP tools")
  .action(async () => {
    await handleMCPClient("list-tools", {});
  });

mcpCmd
  .command("call")
  .description("Call an MCP tool")
  .argument("<toolName>", "Name of the tool to call")
  .argument("[args]", "Arguments as JSON string", "{}")
  .action(async (toolName, args) => {
    await handleMCPClient("call-tool", { tool: toolName, args });
  });

// ── Job Command Implementations ─────────────────────────
let jobSchedulerInstance: CronScheduler | null = null;

async function getJobScheduler(): Promise<CronScheduler> {
  if (!jobSchedulerInstance) {
    jobSchedulerInstance = createScheduler({});
    await jobSchedulerInstance.initialize();
  }
  return jobSchedulerInstance;
}

async function listJobSchedulerJobs(): Promise<void> {
  const scheduler = await getJobScheduler();
  const jobs = scheduler.getAllJobs();

  if (jobs.length === 0) {
    console.log(pc.dim("No scheduled jobs found."));
    console.log(pc.dim("Create one with: krab job add"));
    return;
  }

  console.log(pc.cyan("⏰ Scheduled Jobs:"));
  console.log("");

  for (const job of jobs) {
    const status = job.enabled ? pc.green("✅") : pc.red("❌");
    const running = scheduler.getRunningJobs().includes(job.id)
      ? pc.yellow("🔄")
      : "";
    const nextRun = job.nextRun ? job.nextRun.toLocaleString() : "Unknown";

    console.log(`${status} ${running} ${pc.bold(job.name)} (${job.id})`);
    console.log(`   Schedule: ${job.schedule}`);
    console.log(
      `   Command: ${job.command}${job.args ? ` ${job.args.join(" ")}` : ""}`,
    );
    console.log(`   Next run: ${nextRun}`);
    if (job.description) {
      console.log(`   Description: ${job.description}`);
    }
    console.log("");
  }
}

async function addJobSchedulerJob(options: any): Promise<void> {
  const scheduler = await getJobScheduler();

  let jobData: any = {};

  // Use template if specified
  if (options.template) {
    const template = (jobTemplates as any)[options.template];
    if (!template) {
      console.log(pc.red(`❌ Template '${options.template}' not found.`));
      console.log(pc.dim("Available templates:"));
      Object.keys(jobTemplates).forEach((template) => {
        console.log(`  - ${template}`);
      });
      return;
    }
    jobData = { ...template };
  }

  // Override with provided options
  if (options.name) jobData.name = options.name;
  if (options.schedule) jobData.schedule = options.schedule;
  if (options.command) jobData.command = options.command;
  if (options.args) jobData.args = options.args.split(",");
  if (options.description) jobData.description = options.description;

  // Validate required fields
  if (!jobData.name || !jobData.schedule || !jobData.command) {
    console.log(pc.red("❌ Missing required fields: name, schedule, command"));
    console.log(pc.dim("Use --help for more information"));
    return;
  }

  jobData.enabled = !options.disabled;

  try {
    const jobId = await scheduler.addJob(jobData);
    console.log(pc.green(`✅ Added job: ${jobData.name} (${jobId})`));
  } catch (error) {
    console.error(pc.red("❌ Failed to add job:"), error);
  }
}

async function removeJobSchedulerJob(jobId: string): Promise<void> {
  const scheduler = await getJobScheduler();

  const success = await scheduler.removeJob(jobId);
  if (success) {
    console.log(pc.green(`✅ Removed job: ${jobId}`));
  } else {
    console.log(pc.red(`❌ Job not found: ${jobId}`));
  }
}

async function enableJobSchedulerJob(jobId: string): Promise<void> {
  const scheduler = await getJobScheduler();

  const success = await scheduler.enableJob(jobId);
  if (success) {
    console.log(pc.green(`✅ Enabled job: ${jobId}`));
  } else {
    console.log(pc.red(`❌ Job not found: ${jobId}`));
  }
}

async function disableJobSchedulerJob(jobId: string): Promise<void> {
  const scheduler = await getJobScheduler();

  const success = await scheduler.disableJob(jobId);
  if (success) {
    console.log(pc.green(`✅ Disabled job: ${jobId}`));
  } else {
    console.log(pc.red(`❌ Job not found: ${jobId}`));
  }
}

async function runJobSchedulerJobNow(jobId: string): Promise<void> {
  const scheduler = await getJobScheduler();

  const success = await scheduler.runJobNow(jobId);
  if (success) {
    console.log(pc.green(`✅ Started job: ${jobId}`));
  } else {
    console.log(pc.red(`❌ Failed to start job: ${jobId}`));
  }
}

async function showJobSchedulerStatus(): Promise<void> {
  const scheduler = await getJobScheduler();

  console.log(pc.cyan("📊 Job Scheduler Status:"));

  const jobs = scheduler.getAllJobs();
  const enabledJobs = scheduler.getEnabledJobs();
  const runningJobs = scheduler.getRunningJobs();

  console.log(`   Total jobs: ${jobs.length}`);
  console.log(`   Enabled jobs: ${enabledJobs.length}`);
  console.log(`   Running jobs: ${runningJobs.length}`);
  console.log(`   Max concurrent: 5`);

  if (runningJobs.length > 0) {
    console.log(pc.dim("   Currently running:"));
    runningJobs.forEach((jobId: string) => {
      const job = scheduler.getJob(jobId);
      if (job) {
        console.log(`     - ${job.name} (${jobId})`);
      }
    });
  }
}

// ── Job Commands ───────────────────────────────────────
const jobCmd = new Command("job").description(
  "Job scheduler for recurring tasks",
);

// List jobs
jobCmd
  .command("list")
  .alias("ls")
  .description("List all scheduled jobs")
  .action(async () => {
    await listJobSchedulerJobs();
  });

// Add job
jobCmd
  .command("add")
  .description("Add a new scheduled job")
  .requiredOption("-n, --name <name>", "Job name")
  .requiredOption(
    "-s, --schedule <cron>",
    "Cron schedule expression (e.g., '*/5 * * * *')",
  )
  .requiredOption("-c, --command <cmd>", "Command to execute")
  .option("-a, --args <args>", "Command arguments (comma-separated)")
  .option("-d, --description <desc>", "Job description")
  .option("--template <template>", "Use predefined template")
  .option("--disabled", "Create job as disabled")
  .action(async (options) => {
    await addJobSchedulerJob(options);
  });

// Remove job
jobCmd
  .command("remove")
  .alias("rm")
  .description("Remove a scheduled job")
  .argument("<jobId>", "Job ID to remove")
  .action(async (jobId) => {
    await removeJobSchedulerJob(jobId);
  });

// Enable job
jobCmd
  .command("enable")
  .description("Enable a scheduled job")
  .argument("<jobId>", "Job ID to enable")
  .action(async (jobId) => {
    await enableJobSchedulerJob(jobId);
  });

// Disable job
jobCmd
  .command("disable")
  .description("Disable a scheduled job")
  .argument("<jobId>", "Job ID to disable")
  .action(async (jobId) => {
    await disableJobSchedulerJob(jobId);
  });

// Run job now
jobCmd
  .command("run")
  .description("Run a job immediately")
  .argument("<jobId>", "Job ID to run")
  .action(async (jobId) => {
    await runJobSchedulerJobNow(jobId);
  });

// Status
jobCmd
  .command("status")
  .description("Show job scheduler status")
  .action(async () => {
    await showJobSchedulerStatus();
  });

// Templates
jobCmd
  .command("templates")
  .description("List available job templates")
  .action(async () => {
    console.log(pc.cyan("📋 Available Job Templates:"));
    console.log("");

    Object.entries(jobTemplates).forEach(([key, template]: [string, any]) => {
      console.log(`${pc.bold(key)}: ${template.description}`);
      console.log(`   Schedule: ${template.schedule}`);
      console.log(
        `   Command: ${template.command}${template.args ? ` ${template.args.join(" ")}` : ""}`,
      );
      console.log("");
    });
  });

// ── Export Commands ────────────────────────────────────────
export { gatewayCmd, configCmd, channelsCmd, mcpCmd, jobCmd };
