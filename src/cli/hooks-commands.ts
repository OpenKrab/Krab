// ============================================================
// 🦀 Krab — Hooks Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { hooksManager } from "../hooks/index.js";

// ── Hooks Commands ──────────────────────────────────────────
const hooksCmd = new Command("hooks")
  .description("Hooks management (automation scripts)")
  .action(async () => {
    await listHooks();
  });

// Subcommands
hooksCmd
  .command("list")
  .description("List all available hooks")
  .action(async () => {
    await listHooks();
  });

hooksCmd
  .command("info <name>")
  .description("Show detailed information about a hook")
  .action(async (name: string) => {
    await showHookInfo(name);
  });

hooksCmd
  .command("enable <name>")
  .description("Enable a hook")
  .action(async (name: string) => {
    await enableHook(name);
  });

hooksCmd
  .command("disable <name>")
  .description("Disable a hook")
  .action(async (name: string) => {
    await disableHook(name);
  });

hooksCmd
  .command("check <name>")
  .description("Check if a hook is eligible to run")
  .action(async (name: string) => {
    await checkHookEligibility(name);
  });

// ── Command Implementations ──────────────────────────────────

async function listHooks() {
  const hooks = hooksManager.getHooks();

  if (hooks.length === 0) {
    console.log(pc.dim("No hooks found."));
    return;
  }

  console.log(pc.bold("Available Hooks:"));
  console.log("");

  for (const hook of hooks) {
    const status = hook.enabled ? pc.green("✓") : pc.red("✗");
    const emoji = hook.metadata.metadata.openclaw.emoji || "🔗";
    console.log(`${status} ${emoji} ${pc.bold(hook.metadata.name)}`);
    console.log(`  ${hook.metadata.description || "No description"}`);
    console.log(pc.dim(`  Events: ${hook.metadata.metadata.openclaw.events.join(", ")}`));
    console.log("");
  }
}

async function showHookInfo(name: string) {
  const hooks = hooksManager.getHooks();
  const hook = hooks.find(h => h.metadata.name === name);

  if (!hook) {
    console.log(pc.red(`Hook "${name}" not found.`));
    return;
  }

  console.log(pc.bold(`${hook.metadata.metadata.openclaw.emoji || "🔗"} ${hook.metadata.name}`));
  console.log("");
  console.log(pc.bold("Description:"));
  console.log(hook.metadata.description || "No description");
  console.log("");
  console.log(pc.bold("Status:"));
  console.log(hook.enabled ? pc.green("Enabled") : pc.red("Disabled"));
  console.log("");
  console.log(pc.bold("Events:"));
  for (const event of hook.metadata.metadata.openclaw.events) {
    console.log(`  • ${event}`);
  }
  console.log("");
  console.log(pc.bold("Path:"));
  console.log(pc.dim(hook.path));
  console.log("");
  console.log(pc.bold("Homepage:"));
  console.log(hook.metadata.homepage || "No homepage");
}

async function enableHook(name: string) {
  if (hooksManager.enableHook(name)) {
    console.log(pc.green(`✓ Hook "${name}" enabled.`));
  } else {
    console.log(pc.red(`✗ Hook "${name}" not found.`));
  }
}

async function disableHook(name: string) {
  if (hooksManager.disableHook(name)) {
    console.log(pc.yellow(`✓ Hook "${name}" disabled.`));
  } else {
    console.log(pc.red(`✗ Hook "${name}" not found.`));
  }
}

async function checkHookEligibility(name: string) {
  const hooks = hooksManager.getHooks();
  const hook = hooks.find(h => h.metadata.name === name);

  if (!hook) {
    console.log(pc.red(`Hook "${name}" not found.`));
    return;
  }

  const eligible = hook.enabled; // Simplified - in real impl, check requirements again
  console.log(pc.bold(`Hook "${name}" eligibility:`));
  console.log(`Status: ${eligible ? pc.green("Eligible") : pc.red("Not eligible")}`);

  if (hook.metadata.metadata.openclaw.requires) {
    console.log("");
    console.log(pc.bold("Requirements:"));
    const req = hook.metadata.metadata.openclaw.requires;

    if (req.bins) {
      console.log(`Bins: ${req.bins.join(", ")}`);
    }
    if (req.env) {
      console.log(`Env vars: ${req.env.join(", ")}`);
    }
    if (req.os) {
      console.log(`OS: ${req.os.join(", ")}`);
    }
  }
}

export { hooksCmd };
