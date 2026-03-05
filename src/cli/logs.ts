// ============================================================
// 🦀 Krab — Logs Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";

const LOG_DIR = join(homedir(), ".krab", "logs");

function getLogFiles(): string[] {
  if (!fs.existsSync(LOG_DIR)) {
    return [];
  }
  try {
    return fs.readdirSync(LOG_DIR).filter(f => f.endsWith(".log"));
  } catch {
    return [];
  }
}

function readLogFile(filename: string, lines: number = 100): string {
  const filepath = join(LOG_DIR, filename);
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
        console.log(pc.dim(`Log directory: ${LOG_DIR}\n`));
        return;
      }

      const lines = parseInt(options.lines) || 100;

      if (options.follow) {
        console.log(pc.bold("\n📋 Following logs (Ctrl+C to exit)\n"));
        const latestFile = logFiles.sort().pop();
        if (latestFile) {
          console.log(pc.dim(`Watching: ${latestFile}\n`));
          
          let lastSize = 0;
          const filepath = join(LOG_DIR, latestFile);
          
          const watchLog = () => {
            try {
              const stats = fs.statSync(filepath);
              if (stats.size > lastSize) {
                const content = fs.readFileSync(filepath, "utf-8");
                const newContent = content.slice(lastSize);
                process.stdout.write(newContent);
                lastSize = stats.size;
              }
            } catch (err) {
              // Ignore errors
            }
          };

          // Initial read
          const content = fs.readFileSync(filepath, "utf-8");
          const allLines = content.split("\n");
          console.log(allLines.slice(-lines).join("\n"));
          lastSize = content.length;

          // Watch for changes
          const interval = setInterval(watchLog, 1000);
          
          process.on("SIGINT", () => {
            clearInterval(interval);
            console.log(pc.dim("\n\nStopped watching\n"));
            process.exit(0);
          });
        }
        return;
      }

      console.log(pc.bold(`\n📋 Log Files (${logFiles.length})\n`));

      for (const file of logFiles) {
        const content = readLogFile(file, lines);
        console.log(pc.cyan(`\n=== ${file} ===\n`));
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
    for (const file of logFiles) {
      const filepath = join(LOG_DIR, file);
      const stats = fs.statSync(filepath);
      const size = (stats.size / 1024).toFixed(1);
      console.log(`  ${file} ${pc.dim(`(${size} KB)`)}`);
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

    for (const file of logFiles) {
      const filepath = join(LOG_DIR, file);
      try {
        fs.unlinkSync(filepath);
      } catch {
        // Ignore errors
      }
    }

    console.log(pc.green(`\n✓ Cleared ${logFiles.length} log file(s)\n`));
  });
