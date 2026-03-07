// ============================================================
// 🦀 Krab — Bootstrap Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { createBootstrapManager, checkAndRunBootstrap } from "../bootstrap/index.js";
import { loadConfig } from "../core/config.js";
import * as path from "path";
import * as os from "os";

// ── Bootstrap Commands ──────────────────────────────────────
const bootstrapCmd = new Command("bootstrap")
  .description("Agent bootstrapping and identity management")
  .action(async () => {
    await runBootstrap();
  });

// Subcommands
bootstrapCmd
  .command("run")
  .description("Run the bootstrap process if needed")
  .action(async () => {
    await runBootstrap();
  });

bootstrapCmd
  .command("force")
  .description("Force re-run bootstrap (removes existing identity files)")
  .action(async () => {
    await forceBootstrap();
  });

bootstrapCmd
  .command("status")
  .description("Check bootstrap status")
  .action(async () => {
    await checkBootstrapStatus();
  });

bootstrapCmd
  .command("identity")
  .description("Show current agent identity")
  .action(async () => {
    await showIdentity();
  });

// ── Command Implementations ──────────────────────────────────

async function runBootstrap(): Promise<void> {
  try {
    console.log(pc.cyan("🤖 Starting agent bootstrap..."));

    await checkAndRunBootstrap();

    console.log(pc.green("✅ Bootstrap completed successfully!"));
    console.log(pc.dim("Your agent identity files are ready."));
    console.log(pc.dim("Run 'krab bootstrap identity' to view them."));

  } catch (error) {
    console.error(pc.red("❌ Bootstrap failed:"), error);
    process.exit(1);
  }
}

async function forceBootstrap(): Promise<void> {
  const config = loadConfig();
  const workspacePath = config.agents?.defaults?.workspace || path.join(os.homedir(), ".krab", "workspace");

  const bootstrap = createBootstrapManager({ workspacePath, force: true });
  bootstrap.forceRebootstrap();

  console.log(pc.yellow("🔄 Bootstrap reset complete."));
  console.log(pc.dim("Run 'krab bootstrap run' to restart the process."));
}

async function checkBootstrapStatus(): Promise<void> {
  const config = loadConfig();
  const workspacePath = config.agents?.defaults?.workspace || path.join(os.homedir(), ".krab", "workspace");

  const bootstrap = createBootstrapManager({ workspacePath });

  console.log(pc.bold("Bootstrap Status"));
  console.log("");

  const needsBootstrap = bootstrap.needsBootstrapping();
  console.log(`Needs Bootstrap: ${needsBootstrap ? pc.yellow("Yes") : pc.green("No")}`);
  console.log(`Workspace: ${pc.dim(workspacePath)}`);

  if (!needsBootstrap) {
    console.log(pc.green("✅ Agent is fully bootstrapped"));
  } else {
    console.log(pc.yellow("⚠️  Agent needs bootstrapping"));
    console.log(pc.dim("Run 'krab bootstrap run' to complete setup"));
  }
}

async function showIdentity(): Promise<void> {
  const config = loadConfig();
  const workspacePath = config.agents?.defaults?.workspace || path.join(os.homedir(), ".krab", "workspace");

  const identityPath = path.join(workspacePath, "IDENTITY.md");
  const userPath = path.join(workspacePath, "USER.md");
  const soulPath = path.join(workspacePath, "SOUL.md");

  console.log(pc.bold("Agent Identity"));
  console.log("");

  try {
    if (require("fs").existsSync(identityPath)) {
      console.log(pc.cyan("IDENTITY.md:"));
      console.log(require("fs").readFileSync(identityPath, "utf8"));
      console.log("");
    }

    if (require("fs").existsSync(userPath)) {
      console.log(pc.cyan("USER.md:"));
      console.log(require("fs").readFileSync(userPath, "utf8"));
      console.log("");
    }

    if (require("fs").existsSync(soulPath)) {
      console.log(pc.cyan("SOUL.md:"));
      console.log(require("fs").readFileSync(soulPath, "utf8"));
    }
  } catch (error) {
    console.error(pc.red("Error reading identity files:"), error);
  }
}

export { bootstrapCmd };
