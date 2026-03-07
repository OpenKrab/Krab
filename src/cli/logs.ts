// ============================================================
// 🦀 Krab — Logs Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";

const KRAB_HOME = join(homedir(), ".krab");
const LOG_DIR = join(KRAB_HOME, "logs");
const ROOT_LOG_FILES = ["daemon.log", "gateway.log", "krab.log"];

interface LogFileEntry {
  name: string;
  path: string;
  source: "logs-dir" | "root";
  mtimeMs: number;
  size: number;
}

function getLogFiles(): LogFileEntry[] {
  const entries: LogFileEntry[] = [];

  if (fs.existsSync(LOG_DIR)) {
    try {
      const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".log"));
      for (const file of files) {
        const filepath = join(LOG_DIR, file);
        const stats = fs.statSync(filepath);
        entries.push({
          name: file,
          path: filepath,
          source: "logs-dir",
          mtimeMs: stats.mtimeMs,
          size: stats.size,
        });
      }
    } catch {
      // ignore
    }
  }

  for (const file of ROOT_LOG_FILES) {
    const filepath = join(KRAB_HOME, file);
    if (!fs.existsSync(filepath)) continue;
    try {
      const stats = fs.statSync(filepath);
      entries.push({
        name: file,
        path: filepath,
        source: "root",
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      });
    } catch {
      // ignore
    }
  }

  return entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readLogFile(filepath: string, lines: number = 100): string {
  if (!fs.existsSync(filepath)) {
    return "";
  }

  try {
    const content = fs.readFileSync(filepath, "utf-8");
    const allLines = content.split("\n");
    return allLines.slice(-lines).join("\n");
  } catch {
    return "";
  }
}

export const logsCommand = new Command("logs")
  .description("View system logs")
  .option("-f, --follow", "Follow log output (tail)")
  .option("-n, --lines <number>", "Number of lines to show", "100")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      const logFiles = getLogFiles();

      if (logFiles.length === 0) {
        console.log(pc.yellow("\nNo log files found\n"));
        console.log(pc.dim(`Searched: ${LOG_DIR}`));
        console.log(pc.dim(`Searched: ${KRAB_HOME}/*.log\n`));
        return;
      }

      const lines = parseInt(options.lines) || 100;

      if (options.follow) {
        const latestFile = logFiles[0];
        console.log(pc.bold("\n📋 Following logs (Ctrl+C to exit)\n"));
        console.log(pc.dim(`Watching: ${latestFile.name} (${latestFile.path})\n`));

        let lastSize = 0;

        const watchLog = () => {
          try {
            const stats = fs.statSync(latestFile.path);
            if (stats.size > lastSize) {
              const content = fs.readFileSync(latestFile.path, "utf-8");
              const newContent = content.slice(lastSize);
              process.stdout.write(newContent);
              lastSize = stats.size;
            }
          } catch {
            // Ignore errors
          }
        };

        const content = fs.readFileSync(latestFile.path, "utf-8");
        const allLines = content.split("\n");
        console.log(allLines.slice(-lines).join("\n"));
        lastSize = content.length;

        const interval = setInterval(watchLog, 1000);

        process.on("SIGINT", () => {
          clearInterval(interval);
          console.log(pc.dim("\n\nStopped watching\n"));
          process.exit(0);
        });
        return;
      }

      if (options.json) {
        const payload = logFiles.map((entry) => ({
          name: entry.name,
          path: entry.path,
          source: entry.source,
          size: entry.size,
          mtimeMs: entry.mtimeMs,
          tail: readLogFile(entry.path, lines),
        }));
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(pc.bold(`\n📋 Log Files (${logFiles.length})\n`));

      for (const entry of logFiles) {
        const content = readLogFile(entry.path, lines);
        console.log(pc.cyan(`\n=== ${entry.name} ===`));
        console.log(pc.dim(`${entry.path}\n`));
        console.log(content || pc.dim("(empty)"));
      }

      console.log();
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

logsCommand
  .command("list")
  .description("List available log files")
  .action(() => {
    const logFiles = getLogFiles();

    if (logFiles.length === 0) {
      console.log(pc.yellow("\nNo log files found\n"));
      return;
    }

    console.log(pc.bold("\n📁 Log Files\n"));
    for (const entry of logFiles) {
      const size = (entry.size / 1024).toFixed(1);
      console.log(
        `  ${entry.name} ${pc.dim(`(${size} KB)`)} ${pc.dim(`[${entry.source}]`)}`,
      );
    }
    console.log();
  });

logsCommand
  .command("clear")
  .description("Clear all log files")
  .action(() => {
    const logFiles = getLogFiles();

    if (logFiles.length === 0) {
      console.log(pc.yellow("\nNo log files to clear\n"));
      return;
    }

    let cleared = 0;
    for (const entry of logFiles) {
      try {
        fs.unlinkSync(entry.path);
        cleared++;
      } catch {
        // ignore
      }
    }

    console.log(pc.green(`\n✓ Cleared ${cleared} log file(s)\n`));
  });
