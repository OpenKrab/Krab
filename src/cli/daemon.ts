// ============================================================
// 🦀 Krab — Daemon Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { spawn, execSync } from "child_process";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";

const PID_FILE = join(homedir(), ".krab", "daemon.pid");
const LOG_FILE = join(homedir(), ".krab", "daemon.log");

function isRunning(): boolean {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }
  
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"));
    // Check if process exists (platform specific)
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

function getPid(): number | null {
  try {
    return parseInt(fs.readFileSync(PID_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export const daemonCommand = new Command("daemon")
  .description("Run Krab as a background daemon")
  .addCommand(
    new Command("start")
      .description("Start the daemon")
      .option("--gateway", "Start with gateway server")
      .action(async (_options) => {
        if (isRunning()) {
          console.log(pc.yellow("\n⚠️  Daemon is already running\n"));
          return;
        }

        console.log(pc.dim("\n🚀 Starting Krab daemon...\n"));

        const args = ["dist/cli.js", "gateway", "start"];

        // Start detached process
        const child = spawn("node", args, {
          detached: true,
          stdio: ["ignore", fs.openSync(LOG_FILE, "a"), fs.openSync(LOG_FILE, "a")],
        });

        child.unref();

        // Save PID
        fs.writeFileSync(PID_FILE, child.pid.toString());

        console.log(pc.green(`✓ Daemon started (PID: ${child.pid})`));
        console.log(pc.dim(`  Log: ${LOG_FILE}\n`));
      })
  )
  .addCommand(
    new Command("stop")
      .description("Stop the daemon")
      .action(() => {
        if (!isRunning()) {
          console.log(pc.yellow("\n⚠️  Daemon is not running\n"));
          return;
        }

        const pid = getPid();
        if (pid) {
          try {
            process.kill(pid, "SIGTERM");
            fs.unlinkSync(PID_FILE);
            console.log(pc.green("\n✓ Daemon stopped\n"));
          } catch (err: any) {
            console.error(pc.red(`\n✗ Failed to stop daemon: ${err.message}\n`));
            process.exit(1);
          }
        }
      })
  )
  .addCommand(
    new Command("restart")
      .description("Restart the daemon")
      .action(async () => {
        console.log(pc.dim("\n🔄 Restarting daemon...\n"));
        
        // Stop
        if (isRunning()) {
          const pid = getPid();
          if (pid) {
            try {
              process.kill(pid, "SIGTERM");
              fs.unlinkSync(PID_FILE);
            } catch {
              // Ignore
            }
          }
        }

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start
        const args = ["dist/cli.js", "gateway", "start"];
        const child = spawn("node", args, {
          detached: true,
          stdio: ["ignore", fs.openSync(LOG_FILE, "a"), fs.openSync(LOG_FILE, "a")],
        });

        child.unref();
        fs.writeFileSync(PID_FILE, child.pid.toString());

        console.log(pc.green(`✓ Daemon restarted (PID: ${child.pid})\n`));
      })
  )
  .addCommand(
    new Command("status")
      .description("Check daemon status")
      .action(() => {
        if (isRunning()) {
          const pid = getPid();
          console.log(pc.green(`\n✓ Daemon is running (PID: ${pid})\n`));
          console.log(pc.dim(`  Log: ${LOG_FILE}`));
          
          // Show last few log lines
          try {
            const log = fs.readFileSync(LOG_FILE, "utf-8");
            const lines = log.split("\n").slice(-5);
            if (lines.length > 0 && lines[0]) {
              console.log(pc.dim("\n  Recent logs:"));
              for (const line of lines) {
                if (line) console.log(pc.dim(`    ${line.slice(0, 80)}`));
              }
            }
          } catch {
            // Ignore
          }
          console.log();
        } else {
          console.log(pc.yellow("\n⚠️  Daemon is not running\n"));
        }
      })
  )
  .addCommand(
    new Command("logs")
      .description("View daemon logs")
      .option("-f, --follow", "Follow log output")
      .option("-n, --lines <number>", "Number of lines", "50")
      .action((options) => {
        if (!fs.existsSync(LOG_FILE)) {
          console.log(pc.yellow("\nNo log file found\n"));
          return;
        }

        try {
          const content = fs.readFileSync(LOG_FILE, "utf-8");
          const lines = content.split("\n");
          const numLines = parseInt(options.lines) || 50;

          if (options.follow) {
            console.log(pc.bold("\n📋 Following logs (Ctrl+C to exit)\n"));
            console.log(lines.slice(-numLines).join("\n"));
            
            let lastSize = content.length;
            const interval = setInterval(() => {
              try {
                const newContent = fs.readFileSync(LOG_FILE, "utf-8");
                if (newContent.length > lastSize) {
                  process.stdout.write(newContent.slice(lastSize));
                  lastSize = newContent.length;
                }
              } catch {
                // Ignore
              }
            }, 1000);

            process.on("SIGINT", () => {
              clearInterval(interval);
              console.log(pc.dim("\n\nStopped\n"));
              process.exit(0);
            });
          } else {
            console.log(lines.slice(-numLines).join("\n"));
          }
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  );
