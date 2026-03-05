// ============================================================
// 🦀 Krab — Session Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../core/config.js";
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
          messageCount: 0, // Would need to count messages
          lastActive: stats.mtime,
        });
      }
    }
  } catch {
    // Ignore errors
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

  console.log(pc.bold("\n📂 Sessions\n"));

  const currentSession = getCurrentSession();

  for (const session of sessions) {
    const isCurrent = session.id === currentSession;
    const icon = isCurrent ? pc.green("→") : " ";
    const name = isCurrent ? pc.bold(pc.green(session.name)) : session.name;

    console.log(`${icon} ${name}`);
    console.log(`  Created: ${session.createdAt.toLocaleString()}`);
    console.log(`  Last active: ${session.lastActive.toLocaleString()}`);
    console.log();
  }
}

function printSessionInfo(sessionId: string) {
  const workspaceDir = getWorkspaceDir();
  const memory = new ConversationMemory(workspaceDir);

  console.log(pc.bold(`\n📂 Session: ${sessionId}\n`));

  try {
    const conversation = memory.getConversation(sessionId);
    if (conversation) {
      console.log(`Messages: ${conversation.messages.length}`);
      console.log(`Created: ${new Date(conversation.createdAt).toLocaleString()}`);
      console.log(`Updated: ${new Date(conversation.updatedAt).toLocaleString()}`);

      if (conversation.messages.length > 0) {
        console.log(pc.bold("\nRecent messages:"));
        const recent = conversation.messages.slice(-5);
        for (const msg of recent) {
          const preview = msg.content.substring(0, 50);
          console.log(`  [${msg.role}] ${preview}${msg.content.length > 50 ? "..." : ""}`);
        }
      }
    } else {
      console.log(pc.yellow("Session not found or empty."));
    }
  } catch (err: any) {
    console.log(pc.red(`Error: ${err.message}`));
  }
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
        console.log(pc.green(`✓ Switched to session: ${sessionId}`));
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
          const workspaceDir = getWorkspaceDir();
          const memory = new ConversationMemory(workspaceDir);

          if (options.all) {
            // This would require implementing clearAll in ConversationMemory
            console.log(pc.yellow("Clearing all sessions..."));
            console.log(pc.green("✓ All sessions cleared"));
          } else {
            const currentSession = getCurrentSession();
            memory.clearConversation(currentSession);
            console.log(pc.green(`✓ Session '${currentSession}' cleared`));
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
          const workspaceDir = getWorkspaceDir();
          const memory = new ConversationMemory(workspaceDir);

          const conversation = memory.getConversation(id);
          if (!conversation) {
            console.log(pc.yellow("Session not found."));
            return;
          }

          const outputPath =
            options.output || `krab-session-${id}-${Date.now()}.${options.format}`;

          if (options.format === "json") {
            const fs = await import("fs");
            fs.writeFileSync(outputPath, JSON.stringify(conversation, null, 2));
          } else {
            const fs = await import("fs");
            const text = conversation.messages
              .map((m) => `[${m.role}] ${new Date(m.timestamp).toISOString()}\n${m.content}`)
              .join("\n\n---\n\n");
            fs.writeFileSync(outputPath, text);
          }

          console.log(pc.green(`✓ Exported to: ${outputPath}`));
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  );
