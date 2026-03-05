// ============================================================
// 🦀 Krab — Secrets Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as fs from "fs";
import { join } from "path";

const ENV_PATH = join(process.cwd(), ".env");

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) {
    return {};
  }
  
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const env: Record<string, string> = {};
  
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }
  
  return env;
}

function saveEnv(env: Record<string, string>) {
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "********";
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}

export const secretsCommand = new Command("secrets")
  .description("Manage secrets and API keys")
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all secrets")
      .option("--show", "Show full values (not recommended)")
      .action((options) => {
        const env = loadEnv();
        const secrets = Object.entries(env).filter(([key]) => 
          key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET") || key.includes("PASSWORD")
        );

        if (secrets.length === 0) {
          console.log(pc.yellow("\nNo secrets found\n"));
          return;
        }

        console.log(pc.bold(`\n🔐 Secrets (${secrets.length})\n`));

        for (const [key, value] of secrets) {
          const displayValue = options.show ? value : maskSecret(value);
          console.log(`  ${key}: ${pc.dim(displayValue)}`);
        }
        console.log();

        if (!options.show) {
          console.log(pc.dim("Use --show to reveal values (not recommended)\n"));
        }
      })
  )
  .addCommand(
    new Command("set")
      .description("Set a secret")
      .argument("<key>", "Secret key")
      .argument("<value>", "Secret value")
      .action((key, value) => {
        const env = loadEnv();
        env[key] = value;
        saveEnv(env);

        console.log(pc.green(`\n✓ Set ${key}\n`));
        console.log(pc.dim("Restart Krab to apply changes\n"));
      })
  )
  .addCommand(
    new Command("get")
      .description("Get a secret value")
      .argument("<key>", "Secret key")
      .action((key) => {
        const env = loadEnv();
        
        if (!(key in env)) {
          console.log(pc.red(`\n✗ Secret '${key}' not found\n`));
          process.exit(1);
        }

        console.log(env[key]);
      })
  )
  .addCommand(
    new Command("remove")
      .alias("rm")
      .description("Remove a secret")
      .argument("<key>", "Secret key to remove")
      .action((key) => {
        const env = loadEnv();
        
        if (!(key in env)) {
          console.log(pc.red(`\n✗ Secret '${key}' not found\n`));
          process.exit(1);
        }

        delete env[key];
        saveEnv(env);

        console.log(pc.green(`\n✓ Removed ${key}\n`));
      })
  );
