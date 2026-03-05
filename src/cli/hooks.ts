// ============================================================
// 🦀 Krab — Hooks Command (Webhooks)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";

const HOOKS_FILE = join(homedir(), ".krab", "webhooks.json");

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: string;
}

function loadWebhooks(): Webhook[] {
  if (!fs.existsSync(HOOKS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(HOOKS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveWebhooks(hooks: Webhook[]) {
  const dir = join(homedir(), ".krab");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(HOOKS_FILE, JSON.stringify(hooks, null, 2));
}

export const hooksCommand = new Command("hooks")
  .description("Manage webhooks")
  .alias("webhooks")
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all webhooks")
      .action(() => {
        const hooks = loadWebhooks();

        if (hooks.length === 0) {
          console.log(pc.yellow("\nNo webhooks configured\n"));
          return;
        }

        console.log(pc.bold(`\n🪝 Webhooks (${hooks.length})\n`));

        for (const hook of hooks) {
          const status = hook.active ? pc.green("●") : pc.gray("○");
          console.log(`${status} ${hook.name} ${pc.dim(`(${hook.id})`)}`);
          console.log(`   URL: ${pc.dim(hook.url)}`);
          console.log(`   Events: ${hook.events.join(", ")}`);
          console.log();
        }
      })
  )
  .addCommand(
    new Command("add")
      .description("Add a new webhook")
      .argument("<name>", "Webhook name")
      .argument("<url>", "Webhook URL")
      .requiredOption("--events <events>", "Comma-separated event list")
      .option("--secret", "Generate secret for signature verification")
      .action((name, url, options) => {
        const hooks = loadWebhooks();

        const events = options.events.split(",").map((e: string) => e.trim());

        const newHook: Webhook = {
          id: randomBytes(8).toString("hex"),
          name,
          url,
          events,
          secret: options.secret ? randomBytes(16).toString("hex") : undefined,
          active: true,
          createdAt: new Date().toISOString(),
        };

        hooks.push(newHook);
        saveWebhooks(hooks);

        console.log(pc.green("\n✓ Webhook added\n"));
        console.log(`Name: ${name}`);
        console.log(`URL: ${url}`);
        console.log(`Events: ${events.join(", ")}`);
        if (newHook.secret) {
          console.log(`Secret: ${newHook.secret}`);
        }
        console.log();
      })
  )
  .addCommand(
    new Command("remove")
      .alias("rm")
      .description("Remove a webhook")
      .argument("<id>", "Webhook ID")
      .action((id) => {
        const hooks = loadWebhooks();
        const index = hooks.findIndex((h) => h.id === id);

        if (index === -1) {
          console.log(pc.red(`\n✗ Webhook '${id}' not found\n`));
          process.exit(1);
        }

        hooks.splice(index, 1);
        saveWebhooks(hooks);

        console.log(pc.green("\n✓ Webhook removed\n"));
      })
  )
  .addCommand(
    new Command("toggle")
      .description("Enable/disable a webhook")
      .argument("<id>", "Webhook ID")
      .action((id) => {
        const hooks = loadWebhooks();
        const hook = hooks.find((h) => h.id === id);

        if (!hook) {
          console.log(pc.red(`\n✗ Webhook '${id}' not found\n`));
          process.exit(1);
        }

        hook.active = !hook.active;
        saveWebhooks(hooks);

        const status = hook.active ? "enabled" : "disabled";
        console.log(pc.green(`\n✓ Webhook ${status}\n`));
      })
  )
  .addCommand(
    new Command("test")
      .description("Test a webhook")
      .argument("<id>", "Webhook ID")
      .action(async (id) => {
        const hooks = loadWebhooks();
        const hook = hooks.find((h) => h.id === id);

        if (!hook) {
          console.log(pc.red(`\n✗ Webhook '${id}' not found\n`));
          process.exit(1);
        }

        console.log(pc.dim(`\nTesting webhook: ${hook.name}`));
        console.log(`URL: ${hook.url}\n`);

        try {
          const payload = {
            event: "test",
            timestamp: new Date().toISOString(),
            data: { message: "Test webhook" },
          };

          const response = await fetch(hook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(hook.secret ? { "X-Webhook-Secret": hook.secret } : {}),
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            console.log(pc.green(`✓ Webhook responded: ${response.status}`));
          } else {
            console.log(pc.yellow(`⚠ Webhook responded: ${response.status}`));
          }
        } catch (err: any) {
          console.log(pc.red(`✗ Failed: ${err.message}`));
        }
        console.log();
      })
  );
