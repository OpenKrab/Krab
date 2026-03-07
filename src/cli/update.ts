// ============================================================
// 🦀 Krab — Update Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PACKAGE_JSON = join(process.cwd(), "package.json");
const NPM_REGISTRY = "https://registry.npmjs.org/krab/latest";

interface VersionInfo {
  current: string;
  latest: string | null;
  latestSource?: "npm" | "git-tags" | "unknown";
  updateAvailable: boolean;
}

function getCurrentVersion(): string {
  try {
    if (existsSync(PACKAGE_JSON)) {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
      return pkg.version || "0.0.0";
    }
  } catch {
    // Ignore
  }
  return "0.0.0";
}

async function getLatestVersion(): Promise<{ version: string | null; source: "npm" | "git-tags" | "unknown" }> {
  try {
    const response = await fetch(NPM_REGISTRY, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return { version: null, source: "unknown" };
    }

    const data = (await response.json()) as any;
    return { version: data.version || null, source: "npm" };
  } catch {
    try {
      const tag = execSync('git ls-remote --tags --sort="-version:refname" origin "v*"', {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim()
        .split("\n")[0];

      if (!tag) return { version: null, source: "unknown" };
      const ref = tag.split("\t")[1] || "";
      const version = ref.split("/").pop() || "";
      return {
        version: version.startsWith("v") ? version.slice(1) : version || null,
        source: "git-tags",
      };
    } catch {
      return { version: null, source: "unknown" };
    }
  }
}

function compareVersions(current: string, latest: string): boolean {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

async function checkVersion(): Promise<VersionInfo> {
  const current = getCurrentVersion();
  const latestInfo = await getLatestVersion();
  const latest = latestInfo.version;

  return {
    current,
    latest,
    latestSource: latestInfo.source,
    updateAvailable: latest ? compareVersions(current, latest) : false,
  };
}

function printVersionInfo(info: VersionInfo) {
  console.log(pc.bold("\n🦀 Krab Version\n"));
  console.log(`Current: ${pc.cyan(info.current)}`);

  if (info.latest) {
    console.log(`Latest:  ${pc.green(info.latest)}`);
    if (info.latestSource) {
      console.log(pc.dim(`Source:  ${info.latestSource}`));
    }

    if (info.updateAvailable) {
      console.log(pc.yellow("\n⚠️  Update available!"));
      console.log(pc.dim(`Run 'krab update install' to update`));
    } else {
      console.log(pc.green("\n✓ You're up to date!"));
    }
  } else {
    console.log(pc.dim("Latest:  Unable to check (no npm release or git tag found)"));
  }

  console.log();
}

async function updateKrab(): Promise<boolean> {
  console.log(pc.bold("\n🔄 Updating Krab...\n"));

  try {
    // Check if running from npm/pnpm or local
    const isGlobal = process.argv[1]?.includes("node_modules") === false;

    if (isGlobal) {
      console.log(pc.dim("Installing latest version globally..."));

      try {
        execSync("npm install -g krab@latest", {
          stdio: "inherit",
          cwd: process.cwd(),
        });
        console.log(pc.green("\n✓ Updated successfully!"));
        return true;
      } catch {
        // Try pnpm
        try {
          execSync("pnpm add -g krab@latest", {
            stdio: "inherit",
            cwd: process.cwd(),
          });
          console.log(pc.green("\n✓ Updated successfully!"));
          return true;
        } catch {
          console.log(pc.red("\n✗ Update failed"));
          console.log(pc.dim("Try running: npm install -g krab@latest"));
          return false;
        }
      }
    } else {
      // Local development
      console.log(pc.dim("Pulling latest changes from git..."));

      try {
        execSync("git pull origin main", {
          stdio: "inherit",
          cwd: process.cwd(),
        });

        console.log(pc.dim("\nInstalling dependencies..."));
        execSync("pnpm install", {
          stdio: "inherit",
          cwd: process.cwd(),
        });

        console.log(pc.dim("\nBuilding..."));
        execSync("pnpm build", {
          stdio: "inherit",
          cwd: process.cwd(),
        });

        console.log(pc.green("\n✓ Updated successfully!"));
        console.log(pc.dim("Run 'krab --version' to verify"));
        return true;
      } catch (err: any) {
        console.log(pc.red("\n✗ Update failed"));
        console.log(pc.dim(err.message));
        return false;
      }
    }
  } catch (err: any) {
    console.error(pc.red(`\n✗ Error: ${err.message}`));
    return false;
  }
}

function showChangelog() {
  console.log(pc.bold("\n📋 Recent Changes\n"));
  console.log("v0.1.0");
  console.log("  ✓ Initial release");
  console.log("  ✓ Interactive chat");
  console.log("  ✓ Modern Ink TUI");
  console.log("  ✓ Multiple AI providers");
  console.log("  ✓ Tool system");
  console.log("  ✓ MCP support");
  console.log("  ✓ Gateway server");
  console.log();
}

export const updateCommand = new Command("update")
  .description("Check for updates and update Krab")
  .option("--check", "Check for updates only")
  .option("--changelog", "Show changelog")
  .action(async (options) => {
    try {
      if (options.changelog) {
        showChangelog();
        return;
      }

      const versionInfo = await checkVersion();

      if (options.check) {
        printVersionInfo(versionInfo);
        return;
      }

      if (!versionInfo.updateAvailable) {
        printVersionInfo(versionInfo);
        return;
      }

      printVersionInfo(versionInfo);

      // Confirm update
      const rl = createInterface({ input, output });
      const answer = await rl.question(pc.yellow("Do you want to update? (y/N): "));
      rl.close();

      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        const success = await updateKrab();
        process.exit(success ? 0 : 1);
      } else {
        console.log(pc.dim("Update cancelled."));
        process.exit(0);
      }
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// Add subcommands
updateCommand
  .command("check")
  .description("Check for updates without installing")
  .action(async () => {
    try {
      const versionInfo = await checkVersion();
      printVersionInfo(versionInfo);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

updateCommand
  .command("install")
  .description("Install latest update")
  .action(async () => {
    try {
      const versionInfo = await checkVersion();

      if (!versionInfo.updateAvailable) {
        printVersionInfo(versionInfo);
        return;
      }

      printVersionInfo(versionInfo);

      const success = await updateKrab();
      process.exit(success ? 0 : 1);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
