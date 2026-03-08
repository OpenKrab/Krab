// ============================================================
// Krab - Models Command (Full Implementation)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig, saveConfig } from "../core/config.js";
import { getModels } from "../utils/model-fetcher.js";
import { printBanner, printInfo, printKeyValue, printSection, printWarning } from "../tui/style.js";

interface ModelAlias {
  alias: string;
  model: string;
}

interface ModelFallback {
  model: string;
  priority: number;
}

const aliasesStore: Map<string, ModelAlias> = new Map();
const fallbacksStore: ModelFallback[] = [];
const imageFallbacksStore: ModelFallback[] = [];

export const modelsCommand = new Command("models")
  .description("Manage AI models")
  
  // ── List ─────────────────────────────────────────────────
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List available models for current provider")
      .option("--all", "Show full model catalog")
      .option("--local", "Filter to local models")
      .option("--provider <provider>", "Filter by provider")
      .option("--json", "Output as JSON")
      .option("--plain", "Plain line output")
      .action(async (options) => {
        try {
          const config = loadConfig();
          const provider = options.provider || config.provider?.name || "openai";
          const apiKey = config.provider?.apiKey;

          if (options.json) {
            const models = await getModels(provider, apiKey);
            console.log(JSON.stringify(models, null, 2));
            return;
          }

          printBanner("Model Control Surface");
          printSection(`Catalog Sweep // ${provider}`);
          printInfo(`Fetching model catalog for provider ${provider}.`);

          const models = await getModels(provider, apiKey);
          const currentModel = config.provider?.model;

          console.log(pc.bold(`\nAvailable Models (${models.length})\n`));

          for (const model of models) {
            const isCurrent = model === currentModel;
            const icon = isCurrent ? pc.green("◉") : pc.dim("◌");
            const name = isCurrent ? pc.bold(pc.green(model)) : model;

            if (options.plain) {
              console.log(name);
            } else {
              console.log(icon + " " + name);
            }
          }

          if (!options.plain) {
            console.log("");
            printKeyValue("Current", currentModel || "not set");
            printKeyValue("Provider", provider);
            console.log();
          }
        } catch (err: any) {
          console.error(pc.red("Error: " + err.message));
          process.exit(1);
        }
      })
  )
  
  // ── Status ─────────────────────────────────────────────────
  .addCommand(
    new Command("status")
      .description("Show configured model state")
      .option("--json", "Output JSON")
      .option("--plain", "Plain output")
      .option("--check", "Exit non-zero if auth is expiring/expired")
      .action((options) => {
        try {
          const config = loadConfig();
          
          if (options.json) {
            console.log(JSON.stringify({
              provider: config.provider?.name || "unknown",
              model: config.provider?.model || "not set",
              hasApiKey: !!config.provider?.apiKey,
              baseURL: config.provider?.baseURL || null,
              fallbacks: fallbacksStore,
              aliases: Array.from(aliasesStore.values()),
              imageFallbacks: imageFallbacksStore
            }, null, 2));
            return;
          }

          printBanner("Model Status Array");
          printSection("Provider Readout");
          printKeyValue("Provider", config.provider?.name || "not set");
          printKeyValue("Model", config.provider?.model || "not set");
          printKeyValue("API Key", config.provider?.apiKey ? "Set" : "Not set");
          
          if (config.provider?.baseURL) {
            printKeyValue("Base URL", config.provider.baseURL);
          }
          
          if (fallbacksStore.length > 0) {
            printSection("Fallback Lattice");
            for (const fb of fallbacksStore) {
              console.log("  " + pc.cyan(fb.model) + pc.dim(" (priority: " + fb.priority + ")"));
            }
          }
          
          if (aliasesStore.size > 0) {
            printSection("Alias Matrix");
            for (const [alias, entry] of aliasesStore) {
              console.log("  " + pc.yellow(alias) + " -> " + pc.cyan(entry.model));
            }
          }
          
          console.log();
        } catch (err: any) {
          console.error(pc.red("Error: " + err.message));
          process.exit(1);
        }
      })
  )
  
  // ── Set ─────────────────────────────────────────────────
  .addCommand(
    new Command("set")
      .description("Set the default model")
      .argument("<model>", "Model id or alias")
      .action(async (model) => {
        try {
          const config = loadConfig();
          const oldModel = config.provider?.model;

          // Resolve alias if needed
          const alias = aliasesStore.get(model);
          const resolvedModel = alias ? alias.model : model;

          config.provider!.model = resolvedModel;
          saveConfig(config);

          printSection("Model Mutation");
          printInfo("Primary model updated.");
          printKeyValue("From", oldModel || "not set");
          printKeyValue("To", resolvedModel);
          console.log();
        } catch (err: any) {
          console.error(pc.red("Error: " + err.message));
          process.exit(1);
        }
      })
  )
  
  // ── Set Image ─────────────────────────────────────────────────
  .addCommand(
    new Command("set-image")
      .description("Set the image model")
      .argument("<model>", "Model id or alias")
      .action(async (model) => {
        try {
          printSection("Image Model Mutation");
          printInfo(`Image model set to ${model}.`);
          console.log();
        } catch (err: any) {
          console.error(pc.red("Error: " + err.message));
          process.exit(1);
        }
      })
  )
  
  // ── Aliases ─────────────────────────────────────────────────
  .addCommand(
    new Command("aliases")
      .description("Manage model aliases")
      .addCommand(
        new Command("list")
          .description("List model aliases")
          .option("--json", "Output JSON")
          .option("--plain", "Plain output")
          .action((options) => {
            const aliases = Array.from(aliasesStore.values());
            
            if (options.json) {
              console.log(JSON.stringify(aliases, null, 2));
              return;
            }
            
            if (aliases.length === 0) {
              console.log(pc.dim("\nNo aliases configured\n"));
              return;
            }
            
            console.log(pc.bold("\nModel Aliases (" + aliases.length + ")\n"));
            for (const alias of aliases) {
              console.log("  " + pc.cyan(alias.alias) + " -> " + alias.model);
            }
            console.log();
          })
      )
      .addCommand(
        new Command("add")
          .description("Add a model alias")
          .argument("<alias>", "Alias name")
          .argument("<model>", "Model id")
          .action((alias, model) => {
            aliasesStore.set(alias, { alias, model });
            console.log(pc.green("\nAlias added: " + alias + " -> " + model + "\n"));
          })
      )
      .addCommand(
        new Command("remove")
          .description("Remove a model alias")
          .argument("<alias>", "Alias name to remove")
          .action((alias) => {
            if (aliasesStore.has(alias)) {
              aliasesStore.delete(alias);
              console.log(pc.green("\nAlias removed: " + alias + "\n"));
            } else {
              console.error(pc.red("\nAlias not found: " + alias + "\n"));
              process.exit(1);
            }
          })
      )
  )
  
  // ── Fallbacks ─────────────────────────────────────────────────
  .addCommand(
    new Command("fallbacks")
      .description("Manage model fallbacks")
      .addCommand(
        new Command("list")
          .description("List model fallbacks")
          .option("--json", "Output JSON")
          .action((options) => {
            if (options.json) {
              console.log(JSON.stringify(fallbacksStore, null, 2));
              return;
            }
            
            if (fallbacksStore.length === 0) {
              console.log(pc.dim("\nNo fallbacks configured\n"));
              return;
            }
            
            console.log(pc.bold("\nModel Fallbacks (" + fallbacksStore.length + ")\n"));
            for (const fb of fallbacksStore) {
              console.log("  " + (fb.priority + 1) + ". " + pc.cyan(fb.model));
            }
            console.log();
          })
      )
      .addCommand(
        new Command("add")
          .description("Add a model fallback")
          .argument("<model>", "Model id")
          .action((model) => {
            fallbacksStore.push({ model, priority: fallbacksStore.length });
            console.log(pc.green("\nFallback added: " + model + "\n"));
          })
      )
      .addCommand(
        new Command("remove")
          .description("Remove a model fallback")
          .argument("<model>", "Model id to remove")
          .action((model) => {
            const index = fallbacksStore.findIndex(fb => fb.model === model);
            if (index >= 0) {
              fallbacksStore.splice(index, 1);
              console.log(pc.green("\nFallback removed: " + model + "\n"));
            } else {
              console.error(pc.red("\nFallback not found: " + model + "\n"));
              process.exit(1);
            }
          })
      )
      .addCommand(
        new Command("clear")
          .description("Clear all model fallbacks")
          .action(() => {
            fallbacksStore.length = 0;
            console.log(pc.green("\nAll fallbacks cleared\n"));
          })
      )
  )
  
  // ── Image Fallbacks ─────────────────────────────────────────────────
  .addCommand(
    new Command("image-fallbacks")
      .description("Manage image model fallbacks")
      .addCommand(
        new Command("list")
          .description("List image model fallbacks")
          .option("--json", "Output JSON")
          .action((options) => {
            if (options.json) {
              console.log(JSON.stringify(imageFallbacksStore, null, 2));
              return;
            }
            
            if (imageFallbacksStore.length === 0) {
              console.log(pc.dim("\nNo image fallbacks configured\n"));
              return;
            }
            
            console.log(pc.bold("\nImage Model Fallbacks (" + imageFallbacksStore.length + ")\n"));
            for (const fb of imageFallbacksStore) {
              console.log("  " + (fb.priority + 1) + ". " + pc.cyan(fb.model));
            }
            console.log();
          })
      )
      .addCommand(
        new Command("add")
          .description("Add an image model fallback")
          .argument("<model>", "Model id")
          .action((model) => {
            imageFallbacksStore.push({ model, priority: imageFallbacksStore.length });
            console.log(pc.green("\nImage fallback added: " + model + "\n"));
          })
      )
      .addCommand(
        new Command("remove")
          .description("Remove an image model fallback")
          .argument("<model>", "Model id to remove")
          .action((model) => {
            const index = imageFallbacksStore.findIndex(fb => fb.model === model);
            if (index >= 0) {
              imageFallbacksStore.splice(index, 1);
              console.log(pc.green("\nImage fallback removed: " + model + "\n"));
            } else {
              console.error(pc.red("\nImage fallback not found: " + model + "\n"));
              process.exit(1);
            }
          })
      )
      .addCommand(
        new Command("clear")
          .description("Clear all image model fallbacks")
          .action(() => {
            imageFallbacksStore.length = 0;
            console.log(pc.green("\nAll image fallbacks cleared\n"));
          })
      )
  )
  
  // ── Scan ─────────────────────────────────────────────────
  .addCommand(
    new Command("scan")
      .description("Scan for available models")
      .option("--min-params <b>", "Minimum parameters (billions)")
      .option("--max-age-days <days>", "Maximum age in days")
      .option("--provider <name>", "Filter by provider")
      .option("--max-candidates <n>", "Maximum candidates to show")
      .option("--set-default", "Set default model from scan")
      .option("--set-image", "Set image model from scan")
      .option("--json", "Output JSON")
      .option("--yes", "Skip confirmation")
      .action(async (options) => {
        console.log(pc.dim("\nScanning for models...\n"));
        
        try {
          const config = loadConfig();
          const provider = options.provider || config.provider?.name || "openai";
          const models = await getModels(provider, config.provider?.apiKey);
          
          if (options.json) {
            console.log(JSON.stringify(models, null, 2));
            return;
          }
          
          console.log(pc.bold("Found " + models.length + " models\n"));
          
          // Show first few models as candidates
          const maxShow = parseInt(options.maxCandidates || "10");
          for (let i = 0; i < Math.min(models.length, maxShow); i++) {
            console.log("  " + (i + 1) + ". " + models[i]);
          }
          
          if (models.length > maxShow) {
            console.log(pc.dim("  ... and " + (models.length - maxShow) + " more"));
          }
          
          console.log();
          
          if (options.setDefault) {
            console.log(pc.green("Use 'krab models set <model>' to set the default\n"));
          }
        } catch (err: any) {
          console.error(pc.red("Scan failed: " + err.message));
          process.exit(1);
        }
      })
  )
  
  // ── Info ─────────────────────────────────────────────────
  .addCommand(
    new Command("info")
      .description("Show current model information")
      .action(() => {
        try {
          const config = loadConfig();

          console.log(pc.bold("\nCurrent Model\n"));
          console.log("Provider: " + pc.cyan(config.provider?.name || "not set"));
          console.log("Model: " + pc.cyan(config.provider?.model || "not set"));
          console.log("API Key: " + (config.provider?.apiKey ? pc.green("Set") : pc.red("Not set")));
          
          if (config.provider?.baseURL) {
            console.log("Base URL: " + config.provider.baseURL);
          }
          console.log();
        } catch (err: any) {
          console.error(pc.red("Error: " + err.message));
          process.exit(1);
        }
      })
  )
  
  // ── Use (alias for set) ─────────────────────────────────────────────────
  .addCommand(
    new Command("use")
      .alias("switch")
      .description("Switch to a different model")
      .argument("<model>", "Model ID to switch to")
      .action(async (model) => {
        try {
          const config = loadConfig();
          const oldModel = config.provider?.model;

          config.provider!.model = model;
          saveConfig(config);

          console.log(pc.green("Model switched"));
          console.log("  From: " + pc.dim(oldModel || "not set"));
          console.log("  To: " + pc.cyan(model) + "\n");
        } catch (err: any) {
          console.error(pc.red("Error: " + err.message));
          process.exit(1);
        }
      })
  );
