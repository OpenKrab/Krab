// ============================================================
// 🦀 Krab — Plugins CLI Command (Real Implementation)
// krab plugins list|info|create|install|enable|disable|doctor
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { pluginLoader } from "../plugins/loader.js";
import { scaffoldPlugin } from "../plugins/scaffold.js";
import type { LoadedPlugin } from "../plugins/types.js";

export const pluginsCommand = new Command("plugins")
  .description("Manage plugins and extensions")

  // ── List ─────────────────────────────────────────────────
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all installed plugins")
      .option("--json", "Output as JSON")
      .option("--enabled", "Show only enabled plugins")
      .action(async (options) => {
        await pluginLoader.loadAll();
        const plugins = pluginLoader.list();

        if (options.json) {
          console.log(
            JSON.stringify(
              plugins.map((p) => ({
                name: p.manifest.name,
                version: p.manifest.version,
                status: p.status,
                type: p.manifest.krab.type,
                tools: p.registeredTools,
                error: p.error,
              })),
              null,
              2,
            ),
          );
          return;
        }

        if (plugins.length === 0) {
          console.log(pc.dim("\nNo plugins installed\n"));
          console.log(pc.dim("To create a new plugin:"));
          console.log(pc.cyan("  krab plugins create <name>\n"));
          console.log(pc.dim("Plugin directories:"));
          console.log(pc.dim(`  Global: ${pluginLoader.getGlobalDir()}`));
          console.log(pc.dim(`  Local:  ${pluginLoader.getLocalDir()}\n`));
          return;
        }

        const filtered = options.enabled
          ? plugins.filter((p) => p.status === "loaded")
          : plugins;

        console.log(pc.bold(`\n🧩 Plugins (${filtered.length})\n`));

        for (const plugin of filtered) {
          const statusIcon =
            plugin.status === "loaded"
              ? pc.green("✅")
              : plugin.status === "error"
                ? pc.red("❌")
                : pc.yellow("⏸️");

          const typeTag = pc.dim(`[${plugin.manifest.krab.type}]`);

          console.log(
            `  ${statusIcon} ${pc.bold(plugin.manifest.name)} ${pc.dim(`v${plugin.manifest.version}`)} ${typeTag}`,
          );

          if (plugin.manifest.description) {
            console.log(`     ${pc.dim(plugin.manifest.description)}`);
          }

          if (plugin.registeredTools.length > 0) {
            console.log(`     🔧 Tools: ${plugin.registeredTools.join(", ")}`);
          }

          if (plugin.error) {
            console.log(`     ${pc.red(`Error: ${plugin.error}`)}`);
          }
        }

        const stats = pluginLoader.count();
        console.log(
          pc.dim(
            `\n  Total: ${stats.loaded} loaded, ${stats.error} errors, ${stats.disabled} disabled\n`,
          ),
        );
      }),
  )

  // ── Info ─────────────────────────────────────────────────
  .addCommand(
    new Command("info")
      .description("Show detailed plugin information")
      .argument("<name>", "Plugin name")
      .option("--json", "Output as JSON")
      .action(async (name, options) => {
        await pluginLoader.loadAll();
        const plugin = pluginLoader.get(name);

        if (!plugin) {
          console.error(pc.red(`\nPlugin not found: ${name}\n`));
          console.log(
            pc.dim("Run 'krab plugins list' to see available plugins\n"),
          );
          process.exit(1);
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                ...plugin.manifest,
                status: plugin.status,
                path: plugin.path,
                registeredTools: plugin.registeredTools,
                error: plugin.error,
                loadedAt: plugin.loadedAt,
              },
              null,
              2,
            ),
          );
          return;
        }

        const statusColor =
          plugin.status === "loaded"
            ? pc.green
            : plugin.status === "disabled"
              ? pc.yellow
              : pc.red;

        console.log(pc.bold(`\n🧩 Plugin: ${plugin.manifest.name}\n`));
        console.log(`  Version:     ${plugin.manifest.version}`);
        console.log(`  Type:        ${plugin.manifest.krab.type}`);
        console.log(`  Status:      ${statusColor(plugin.status)}`);
        console.log(`  Path:        ${pc.dim(plugin.path)}`);
        console.log(`  Entry:       ${pc.dim(plugin.manifest.krab.entry)}`);

        if (plugin.manifest.description) {
          console.log(`  Description: ${plugin.manifest.description}`);
        }
        if (plugin.manifest.author) {
          console.log(`  Author:      ${plugin.manifest.author}`);
        }

        if (plugin.registeredTools.length > 0) {
          console.log(
            `\n  🔧 Registered Tools (${plugin.registeredTools.length}):`,
          );
          for (const tool of plugin.registeredTools) {
            console.log(`     - ${tool}`);
          }
        }

        const perms = plugin.manifest.krab.permissions || [];
        if (perms.length > 0) {
          console.log(`\n  🔐 Permissions: ${perms.join(", ")}`);
        }

        if (plugin.error) {
          console.log(`\n  ${pc.red(`❌ Error: ${plugin.error}`)}`);
        }

        console.log();
      }),
  )

  // ── Create (Scaffolding) ─────────────────────────────────
  .addCommand(
    new Command("create")
      .description("Create a new plugin from template")
      .argument("<name>", "Plugin name (e.g. my-weather-tool)")
      .option(
        "-t, --type <type>",
        "Plugin type: tool, channel, agent, middleware, mixed",
        "tool",
      )
      .option("-d, --description <desc>", "Plugin description")
      .option("-a, --author <author>", "Author name")
      .option(
        "--dir <directory>",
        "Custom directory (default: ~/.krab/plugins/<name>)",
      )
      .action(async (name, options) => {
        console.log(pc.cyan(`\n🧩 Creating plugin: ${name}\n`));

        try {
          const targetDir = await scaffoldPlugin({
            name,
            type: options.type,
            description: options.description,
            author: options.author,
            directory: options.dir,
          });

          console.log(pc.green(`✅ Plugin created at: ${targetDir}\n`));
          console.log("Next steps:");
          console.log(pc.dim(`  1. cd ${targetDir}`));
          console.log(pc.dim("  2. Edit src/index.ts with your logic"));
          console.log(pc.dim("  3. npm install && npm run build"));
          console.log(
            pc.dim("  4. Restart Krab — your plugin loads automatically!"),
          );
          console.log();
          console.log(
            pc.dim("Or for development, just edit src/index.ts and build it."),
          );
          console.log();
        } catch (err: any) {
          console.error(
            pc.red(`\n❌ Failed to create plugin: ${err.message}\n`),
          );
          process.exit(1);
        }
      }),
  )

  // ── Install ─────────────────────────────────────────────
  .addCommand(
    new Command("install")
      .description("Install a plugin from a local path")
      .argument("<path>", "Path to plugin directory")
      .action(async (pluginPath) => {
        console.log(pc.dim(`\nInstalling plugin from: ${pluginPath}\n`));

        try {
          const { resolve } = await import("node:path");
          const resolved = resolve(pluginPath);
          const plugin = await pluginLoader.load(resolved);

          if (plugin.status === "loaded") {
            await pluginLoader.registerInstall(
              plugin.manifest.name,
              resolved,
              plugin.manifest.version,
              "local",
            );
            console.log(
              pc.green(
                `✅ Plugin installed: ${plugin.manifest.name} v${plugin.manifest.version}`,
              ),
            );
            if (plugin.registeredTools.length > 0) {
              console.log(`   🔧 Tools: ${plugin.registeredTools.join(", ")}`);
            }
          } else {
            console.error(pc.red(`❌ Plugin failed to load: ${plugin.error}`));
          }
          console.log();
        } catch (err: any) {
          console.error(pc.red(`\n❌ Installation failed: ${err.message}\n`));
          process.exit(1);
        }
      }),
  )

  // ── Enable ─────────────────────────────────────────────
  .addCommand(
    new Command("enable")
      .description("Enable a disabled plugin")
      .argument("<name>", "Plugin name")
      .action(async (name) => {
        const success = await pluginLoader.enable(name);
        if (success) {
          console.log(pc.green(`\n✅ Plugin enabled: ${name}`));
          console.log(pc.dim("Restart Krab to apply changes\n"));
        } else {
          console.error(pc.red(`\nPlugin not found: ${name}\n`));
        }
      }),
  )

  // ── Disable ─────────────────────────────────────────────
  .addCommand(
    new Command("disable")
      .description("Disable a plugin")
      .argument("<name>", "Plugin name")
      .action(async (name) => {
        const success = await pluginLoader.disable(name);
        if (success) {
          console.log(pc.green(`\n✅ Plugin disabled: ${name}`));
          console.log(pc.dim("Restart Krab to apply changes\n"));
        } else {
          console.error(pc.red(`\nPlugin not found: ${name}\n`));
        }
      }),
  )

  // ── Doctor ─────────────────────────────────────────────
  .addCommand(
    new Command("doctor")
      .description("Check plugin health and diagnose issues")
      .action(async () => {
        await pluginLoader.loadAll();
        const plugins = pluginLoader.list();
        const stats = pluginLoader.count();

        console.log(pc.bold("\n🩺 Plugin Health Check\n"));

        console.log(`  📁 Global dir: ${pluginLoader.getGlobalDir()}`);
        console.log(`  📁 Local dir:  ${pluginLoader.getLocalDir()}`);
        console.log();

        if (plugins.length === 0) {
          console.log(pc.green("  ✅ No plugins installed — nothing to check"));
        } else {
          console.log(
            `  Total: ${stats.total} | ` +
              pc.green(`Loaded: ${stats.loaded}`) +
              ` | ` +
              (stats.error > 0
                ? pc.red(`Errors: ${stats.error}`)
                : pc.green("Errors: 0")) +
              ` | ` +
              (stats.disabled > 0
                ? pc.yellow(`Disabled: ${stats.disabled}`)
                : `Disabled: 0`),
          );
          console.log();

          for (const plugin of plugins) {
            if (plugin.status === "error") {
              console.log(
                `  ${pc.red("❌")} ${plugin.manifest.name}: ${pc.red(plugin.error || "Unknown error")}`,
              );
            } else if (plugin.status === "disabled") {
              console.log(
                `  ${pc.yellow("⏸️")} ${plugin.manifest.name}: disabled`,
              );
            } else {
              console.log(
                `  ${pc.green("✅")} ${plugin.manifest.name}: healthy`,
              );
            }
          }
        }

        console.log();
      }),
  );
