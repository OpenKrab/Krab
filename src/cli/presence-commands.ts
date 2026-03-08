// ============================================================
// 🦀 Krab — Presence Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { presenceTracker } from "../presence/tracker.js";
import { printBanner, printInfo, printKeyValue, printSection, printWarning } from "../tui/style.js";

// ── Presence Commands ───────────────────────────────────────
const presenceCmd = new Command("presence")
  .description("Presence tracking and monitoring")
  .action(async () => {
    await showPresence();
  });

// Subcommands
presenceCmd
  .command("list")
  .description("List active presence entries")
  .action(async () => {
    await showPresence();
  });

presenceCmd
  .command("stats")
  .description("Show presence statistics")
  .action(async () => {
    await showPresenceStats();
  });

presenceCmd
  .command("update")
  .description("Update presence for current instance")
  .option("--mode <mode>", "Mode (cli/gateway/ui/backend)")
  .option("--reason <reason>", "Reason (self/connect/beacon)")
  .action(async (options) => {
    await updatePresence(options);
  });

// ── Command Implementations ──────────────────────────────────

async function showPresence(): Promise<void> {
  const entries = presenceTracker.getActivePresence();
  const stats = presenceTracker.getStats();

  printBanner("Presence Control Surface");
  printSection("Presence Overview");
  printKeyValue("Active Entries", String(stats.active));
  printKeyValue("Total Entries", String(stats.total));
  printKeyValue("Modes", Object.keys(stats.byMode).length ? Object.keys(stats.byMode).join(", ") : "none");
  console.log("");

  if (entries.length === 0) {
    printWarning("No active presence entries found.");
    return;
  }

  printSection("Active Instances");

  for (const entry of entries) {
    console.log(`${pc.cyan(entry.instanceId || "unknown")}`);
    console.log(`  Host: ${entry.host}`);
    console.log(`  IP: ${entry.ip || "unknown"}`);
    console.log(`  Mode: ${entry.mode}`);
    console.log(`  Version: ${entry.version}`);
    console.log(`  Reason: ${entry.reason}`);
    console.log(`  Last Seen: ${new Date(entry.ts).toLocaleString()}`);
    if (entry.lastInputSeconds !== undefined) {
      console.log(`  Last Input: ${entry.lastInputSeconds}s ago`);
    }
    if (entry.agentId) {
      console.log(`  Agent: ${entry.agentId}`);
    }
    if (entry.channel) {
      console.log(`  Channel: ${entry.channel}`);
    }
    console.log("");
  }
}

async function showPresenceStats(): Promise<void> {
  const stats = presenceTracker.getStats();

  printBanner("Presence Control Surface");
  printSection("Presence Statistics");
  printKeyValue("Total Entries", String(stats.total));
  printKeyValue("Active Entries", String(stats.active));
  console.log("");

  if (Object.keys(stats.byMode).length > 0) {
    printInfo("By mode:");
    for (const [mode, count] of Object.entries(stats.byMode)) {
      console.log(`  ${mode}: ${count}`);
    }
    console.log("");
  }

  if (Object.keys(stats.byReason).length > 0) {
    printInfo("By reason:");
    for (const [reason, count] of Object.entries(stats.byReason)) {
      console.log(`  ${reason}: ${count}`);
    }
  }
}

async function updatePresence(options: { mode?: string; reason?: string }): Promise<void> {
  try {
    const entry = presenceTracker.updatePresence({
      mode: (options.mode as any) || "cli",
      reason: (options.reason as any) || "beacon"
    });

    printBanner("Presence Control Surface");
    printSection("Presence Updated");
    printKeyValue("Instance ID", entry.instanceId || "unknown");
    printKeyValue("Mode", entry.mode);
    printKeyValue("Reason", entry.reason);
    console.log("");

  } catch (error) {
    console.error(pc.red("❌ Failed to update presence:"), error);
  }
}

export { presenceCmd };
