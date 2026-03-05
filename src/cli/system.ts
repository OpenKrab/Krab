// ============================================================
// 🦀 Krab — System Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as os from "os";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";

function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function getDiskUsage(path: string): { used: number; total: number; free: number } {
  try {
    const stats = fs.statSync(path);
    // This is a simplified version - real disk usage requires platform-specific code
    return { used: 0, total: 0, free: 0 };
  } catch {
    return { used: 0, total: 0, free: 0 };
  }
}

export const systemCommand = new Command("system")
  .description("Show system information")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      const info = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || "Unknown",
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
        hostname: os.hostname(),
        homeDir: homedir(),
        loadAverage: os.loadavg().map(l => l.toFixed(2)),
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      console.log(pc.bold("\n💻 System Information\n"));
      console.log(`Platform:     ${pc.cyan(info.platform)} (${info.arch})`);
      console.log(`Node.js:      ${pc.cyan(info.nodeVersion)}`);
      console.log(`Hostname:     ${info.hostname}`);
      console.log();
      console.log(pc.bold("CPU"));
      console.log(`  Model:      ${info.cpuModel}`);
      console.log(`  Cores:      ${info.cpuCount}`);
      console.log(`  Load Avg:   ${info.loadAverage.join(", ")}`);
      console.log();
      console.log(pc.bold("Memory"));
      console.log(`  Total:      ${info.totalMemory}`);
      console.log(`  Free:       ${info.freeMemory}`);
      console.log();
      console.log(pc.bold("System"));
      console.log(`  Uptime:     ${info.uptime}`);
      console.log(`  Home Dir:   ${pc.dim(info.homeDir)}`);
      console.log();
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

systemCommand
  .command("memory")
  .description("Show detailed memory usage")
  .action(() => {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = ((used / total) * 100).toFixed(1);

    console.log(pc.bold("\n🧠 Memory Usage\n"));
    console.log(`Total:     ${pc.cyan(formatBytes(total))}`);
    console.log(`Used:      ${pc.yellow(formatBytes(used))} (${percentage}%)`);
    console.log(`Free:      ${pc.green(formatBytes(free))}`);
    console.log();
  });

systemCommand
  .command("cpu")
  .description("Show CPU information")
  .action(() => {
    const cpus = os.cpus();
    
    console.log(pc.bold("\n🖥️  CPU Information\n"));
    console.log(`Model:     ${pc.cyan(cpus[0]?.model || "Unknown")}`);
    console.log(`Cores:     ${cpus.length}`);
    console.log(`Speed:     ${cpus[0]?.speed || 0} MHz`);
    console.log(`Load Avg:  ${os.loadavg().map(l => l.toFixed(2)).join(", ")}`);
    console.log();
  });
