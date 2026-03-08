// ============================================================
// 🦀 Krab — Secrets Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import {
  createRuntimeSecretsManager,
  readSecretsEnvFile,
  writeSecretsEnvFile,
  SecretsManager,
} from "../core/secrets.js";
import { printBanner, printInfo, printKeyValue, printSection, printWarning } from "../tui/style.js";

function loadEnv(): Record<string, string> {
  return readSecretsEnvFile();
}

function saveEnv(env: Record<string, string>) {
  writeSecretsEnvFile(env);
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
          printWarning("No secrets registered in the active state profile.");
          console.log();
          return;
        }

        printBanner("Secrets Control Surface");
        printSection(`Secret Inventory // ${secrets.length} registered`);

        for (const [key, value] of secrets) {
          const displayValue = options.show ? value : maskSecret(value);
          printKeyValue(key, displayValue);
        }
        console.log();

        if (!options.show) {
          printInfo("Use --show to reveal raw values only when operating in a secure terminal.");
          console.log();
        }
      })
  )
  .addCommand(
    new Command("audit")
      .description("Audit configured env secrets via SecretsManager")
      .action(async () => {
        const env = loadEnv();
        const manager = createRuntimeSecretsManager();
        const secretKeys = Object.keys(env).filter((key) =>
          key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET") || key.includes("PASSWORD"),
        );

        if (secretKeys.length === 0) {
          printWarning("No secrets available to audit in the active state profile.");
          console.log();
          return;
        }

        const refs = secretKeys.map((key) => SecretsManager.createEnvRef("default", key));
        const audit = await Promise.all(
          refs.map(async (ref) => {
            const valid = manager.validateSecretRef(ref);
            const resolution: { ok: true; value: any } | { ok: false; error: string } = valid
              ? await manager.tryResolveSecret(ref)
              : { ok: false, error: "Invalid secret reference" };
            const resolvedOk = resolution.ok;
            const resolutionError = resolvedOk ? undefined : (resolution as { ok: false; error: string }).error;

            return {
              key: ref.id,
              valid,
              resolved: resolvedOk,
              error: resolutionError,
            };
          }),
        );

        printBanner("Secrets Audit Grid");
        printSection(`Audit Matrix // ${audit.length} references`);
        for (const entry of audit) {
          const status = entry.resolved ? pc.green("ONLINE") : pc.red("FAULT");
          console.log(`  ${status} ${pc.bold(entry.key)}${entry.error ? ` ${pc.dim(`- ${entry.error}`)}` : ""}`);
        }
        console.log();
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

        printSection("Secrets Mutation");
        printInfo(`Stored ${key} in the active state profile.`);
        printWarning("Restart Krab to guarantee all running surfaces reload the updated secret.");
        console.log();
      })
  )
  .addCommand(
    new Command("get")
      .description("Get a secret value")
      .argument("<key>", "Secret key")
      .action((key) => {
        const env = loadEnv();
        
        if (!(key in env)) {
          printWarning(`Secret '${key}' not found.`);
          console.log();
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
          printWarning(`Secret '${key}' not found.`);
          console.log();
          process.exit(1);
        }

        delete env[key];
        saveEnv(env);

        printSection("Secrets Mutation");
        printInfo(`Removed ${key} from the active state profile.`);
        console.log();
      })
  );
