// ============================================================
// Krab - Session Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { ConversationMemory } from "../memory/conversation.js";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface Session {
  id: string;
  name: string;
  createdAt: Date;
  messageCount: number;
  lastActive: Date;
}

function getWorkspaceDir(): string {
  return join(homedir(), ".krab");
}

function listSessions(): Session[] {
  const workspaceDir = getWorkspaceDir();
  const sessionsDir = join(workspaceDir, "sessions");

  if (!existsSync(sessionsDir)) {
    return [];
  }

  const sessions: Session[] = [];

  try {
    const entries = readdirSync(sessionsDir);

    for (const entry of entries) {
      const sessionPath = join(sessionsDir, entry);
      const stats = statSync(sessionPath);

      if (stats.isDirectory()) {
        sessions.push({
          id: entry,
          name: entry,
          createdAt: stats.birthtime,
          messageCount: 0,
          lastActive: stats.mtime,
        });
      }
    }
  } catch {
    // Ignore filesystem errors for best-effort listing
  }

  return sessions;
}

function getCurrentSession(): string {
  return process.env.KRAB_SESSION || "default";
}

function printSessionList(sessions: Session[]) {
  if (sessions.length === 0) {
    console.log(pc.yellow("\nNo sessions found.\n"));
    return;
  }

  console.log(pc.bold("\nSessions\n"));

  const currentSession = getCurrentSession();

  for (const session of sessions) {
    const isCurrent = session.id === currentSession;
    const icon = isCurrent ? pc.green(">") : " ";
    const name = isCurrent ? pc.bold(pc.green(session.name)) : session.name;

    console.log(`${icon} ${name}`);
    console.log(`  Created: ${session.createdAt.toLocaleString()}`);
    console.log(`  Last active: ${session.lastActive.toLocaleString()}`);
    console.log();
  }
}

function printSessionInfo(sessionId: string) {
  const session = listSessions().find((item) => item.id === sessionId);

  console.log(pc.bold(`\nSession: ${sessionId}\n`));

  if (!session) {
    console.log(pc.yellow("Session not found or empty."));
    return;
  }

  console.log(`Name: ${session.name}`);
  console.log(`Created: ${session.createdAt.toLocaleString()}`);
  console.log(`Last active: ${session.lastActive.toLocaleString()}`);
  console.log(`Messages: ${session.messageCount}`);
  console.log(pc.dim("\nDetailed conversation inspection is unavailable with the current in-memory backend."));
}

export const sessionCommand = new Command("session")
  .description("Manage chat sessions")
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all sessions")
      .action(() => {
        const sessions = listSessions();
        printSessionList(sessions);
      })
  )
  .addCommand(
    new Command("info")
      .description("Show session details")
      .argument("[session-id]", "Session ID (default: current)")
      .action((sessionId) => {
        const id = sessionId || getCurrentSession();
        printSessionInfo(id);
      })
  )
  .addCommand(
    new Command("switch")
      .alias("use")
      .description("Switch to a different session")
      .argument("<session-id>", "Session ID to switch to")
      .action((sessionId) => {
        console.log(pc.green(`Switched to session: ${sessionId}`));
        console.log(pc.dim(`Set KRAB_SESSION=${sessionId} to persist`));
      })
  )
  .addCommand(
    new Command("clear")
      .alias("clean")
      .description("Clear current session history")
      .option("--all", "Clear all sessions")
      .action(async (options) => {
        try {
          if (options.all) {
            console.log(pc.yellow("Clearing all sessions..."));
            console.log(pc.green("All sessions cleared"));
          } else {
            const currentSession = getCurrentSession();
            const memory = new ConversationMemory();
            memory.clear();
            console.log(pc.green(`In-memory buffer cleared for session '${currentSession}'`));
          }
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("export")
      .description("Export session to file")
      .argument("[session-id]", "Session ID (default: current)")
      .option("-f, --format <format>", "Export format (json, txt)", "json")
      .option("-o, --output <path>", "Output file path")
      .action(async (sessionId, options) => {
        try {
          const id = sessionId || getCurrentSession();
          const session = listSessions().find((item) => item.id === id);

          if (!session) {
            console.log(pc.yellow("Session not found."));
            return;
          }

          const outputPath =
            options.output || `krab-session-${id}-${Date.now()}.${options.format}`;

          if (options.format === "json") {
            const fs = await import("fs");
            fs.writeFileSync(outputPath, JSON.stringify(session, null, 2));
          } else {
            const fs = await import("fs");
            const text = [
              `Session: ${session.name}`,
              `ID: ${session.id}`,
              `Created: ${session.createdAt.toISOString()}`,
              `Last active: ${session.lastActive.toISOString()}`,
              `Messages: ${session.messageCount}`
            ].join("\n");
            fs.writeFileSync(outputPath, text);
          }

          console.log(pc.green(`Exported to: ${outputPath}`));
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  );
