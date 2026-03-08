// ============================================================
// 🦀 Krab — Session Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { sessionStore } from "../session/store.js";
import { SessionMaintenance, MaintenanceConfig } from "../session/maintenance.js";
import { loadConfig } from "../core/config.js";
import * as path from "path";
import * as os from "os";
import { printBanner, printInfo, printKeyValue, printSection, printWarning } from "../tui/style.js";

// ── Session Commands ────────────────────────────────────────
const sessionCmd = new Command("session")
  .description("Session management and maintenance")
  .action(async () => {
    await listSessions();
  });

// Subcommands
sessionCmd
  .command("list")
  .description("List all active sessions")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await listSessions(options);
  });

sessionCmd
  .command("info <sessionKey>")
  .description("Show detailed information about a session")
  .action(async (sessionKey) => {
    await showSessionInfo(sessionKey);
  });

sessionCmd
  .command("cleanup")
  .description("Run session maintenance and cleanup")
  .option("--dry-run", "Show what would be cleaned up without making changes")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    await cleanupSessions(options);
  });

sessionCmd
  .command("remove <sessionKey>")
  .description("Remove a specific session")
  .action(async (sessionKey) => {
    await removeSession(sessionKey);
  });

sessionCmd
  .command("stats")
  .description("Show session statistics")
  .action(async () => {
    await showSessionStats();
  });

// ── Command Implementations ──────────────────────────────────

async function listSessions(options?: { json?: boolean }): Promise<void> {
  const sessions = sessionStore.getAllSessions();

  if (options?.json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    printBanner("Session Control Surface");
    printSection("Session Inventory");
    printWarning("No active sessions found.");
    return;
  }

  printBanner("Session Control Surface");
  printSection("Session Inventory");
  printKeyValue("Tracked Sessions", String(sessions.length));
  printKeyValue(
    "Active Summary",
    `${sessionStore.getActiveSessionCount()} active // ${sessionStore.getTotalSessionCount()} total`,
  );
  console.log("");

  for (const session of sessions) {
    const age = Math.floor((Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60)); // hours
    console.log(`${pc.cyan(session.sessionKey)}`);
    console.log(`  Channel: ${session.channel}`);
    console.log(`  Mode: ${session.mode}`);
    console.log(`  Messages: ${session.messageCount}`);
    console.log(`  Last Updated: ${session.updatedAt.toLocaleString()} (${age}h ago)`);
    console.log("");
  }
}

async function showSessionInfo(sessionKey: string): Promise<void> {
  const session = sessionStore.getSession(sessionKey);

  if (!session) {
    printBanner("Session Control Surface");
    printSection("Session Inspect");
    printWarning(`Session "${sessionKey}" not found.`);
    return;
  }

  printBanner("Session Control Surface");
  printSection("Session Inspect");
  printKeyValue("Session Key", session.sessionKey);
  printKeyValue("Session ID", session.sessionId);
  printKeyValue("Channel", session.channel);
  printKeyValue("Last Channel", session.lastChannel);
  printKeyValue("Mode", session.mode);
  printKeyValue("Sender ID", session.senderId);
  printKeyValue("Group ID", session.groupId || "N/A");
  printKeyValue("Thread ID", session.threadId || "N/A");
  printKeyValue("Message Count", String(session.messageCount));
  printKeyValue("Queue Mode", session.queueMode);
  printKeyValue("Reply Back", String(session.replyBack));
  printKeyValue("Created", session.createdAt.toLocaleString());
  printKeyValue("Updated", session.updatedAt.toLocaleString());
  printKeyValue("Age", `${Math.floor((Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60))} hours`);
  console.log("");
}

async function cleanupSessions(options?: { dryRun?: boolean; json?: boolean }): Promise<void> {
  const config = loadConfig();
  const defaults = {
    mode: "warn" as const,
    pruneAfter: "30d",
    maxEntries: 500,
    rotateBytes: "10mb",
    resetArchiveRetention: "30d"
  };
  
  const maintenanceConfig: MaintenanceConfig = {
    ...defaults,
    ...config.agents?.defaults?.sessionMaintenance
  };

  const sessionsDir = path.join(os.homedir(), ".krab", "sessions");
  const maintenance = new SessionMaintenance(maintenanceConfig, sessionsDir);

  const result = await maintenance.cleanup(options?.dryRun);

  if (options?.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (maintenanceConfig.mode === "warn") {
    printBanner("Session Control Surface");
    printSection("Session Cleanup Analysis");
    if (result.warnings.length === 0) {
      printInfo("No cleanup needed.");
    } else {
      printWarning("Cleanup recommendations detected.");
      for (const warning of result.warnings) {
        console.log(`  • ${warning}`);
      }
      console.log("");
      console.log(pc.dim("Run with --dry-run=false to apply cleanup"));
    }
  } else {
    printBanner("Session Control Surface");
    printSection("Session Cleanup Results");
    printKeyValue("Pruned Sessions", String(result.pruned));
    printKeyValue("Archived Transcripts", String(result.archived));
    printKeyValue("Rotated Sessions File", result.rotated ? "Yes" : "No");
    printKeyValue("Disk Space Freed", formatBytes(result.diskFreed));

    if (result.warnings.length > 0) {
      console.log("");
      printWarning("Warnings:");
      for (const warning of result.warnings) {
        console.log(`  • ${warning}`);
      }
    }
  }
}

async function removeSession(sessionKey: string): Promise<void> {
  const success = sessionStore.removeSession(sessionKey);

  if (success) {
    console.log(pc.green(`✅ Session "${sessionKey}" removed successfully`));
  } else {
    console.log(pc.red(`❌ Session "${sessionKey}" not found`));
  }
}

async function showSessionStats(): Promise<void> {
  const sessions = sessionStore.getAllSessions();
  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
  const oldestSession = sessions.reduce((oldest, s) =>
    !oldest || s.createdAt < oldest.createdAt ? s : oldest, null as any);
  const newestSession = sessions.reduce((newest, s) =>
    !newest || s.updatedAt > newest.updatedAt ? s : newest, null as any);

  printBanner("Session Control Surface");
  printSection("Session Statistics");
  printKeyValue("Total Sessions", String(totalSessions));
  printKeyValue("Total Messages", String(totalMessages));
  printKeyValue("Average Messages / Session", `${totalSessions > 0 ? (totalMessages / totalSessions).toFixed(1) : 0}`);

  if (oldestSession) {
    printKeyValue("Oldest Session", `${oldestSession.sessionKey} (${oldestSession.createdAt.toLocaleDateString()})`);
  }

  if (newestSession) {
    printKeyValue("Most Recent Activity", `${newestSession.sessionKey} (${newestSession.updatedAt.toLocaleString()})`);
  }

  // Channel breakdown
  const channelStats: Record<string, number> = {};
  for (const session of sessions) {
    channelStats[session.channel] = (channelStats[session.channel] || 0) + 1;
  }

  if (Object.keys(channelStats).length > 0) {
    console.log("");
    printInfo("Sessions by channel:");
    for (const [channel, count] of Object.entries(channelStats)) {
      console.log(`  ${channel}: ${count}`);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export { sessionCmd };
