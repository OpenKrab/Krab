// ============================================================
// 🦀 Krab — Taglines CLI Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { taglines, getRandomTagline, getAllTaglines, getTaglinesByTheme, addTagline, removeTagline } from "../utils/taglines.js";

// ── Taglines Command ────────────────────────────────────────
export const taglinesCmd = new Command("taglines")
  .description("Manage Krab banner taglines")
  .option("-l, --list", "List all taglines")
  .option("-t, --theme <theme>", "Show taglines for specific theme")
  .option("-r, --random <theme>", "Get random tagline from theme")
  .option("-a, --add <theme> <tagline>", "Add new tagline to theme")
  .option("--remove <theme> <tagline>", "Remove tagline from theme")
  .option("--count", "Count taglines per theme")
  .action(async (options, command) => {
    try {
      if (options.list) {
        console.log(pc.cyan("🎯 All Taglines:"));
        console.log("");
        
        Object.entries(taglines).forEach(([theme, themeTaglines]) => {
          console.log(`${pc.bold(theme)} (${themeTaglines.length}):`);
          themeTaglines.forEach((tagline: string, index: number) => {
            console.log(`   ${index + 1}. ${tagline}`);
          });
          console.log("");
        });
        
        return;
      }

      if (options.theme) {
        const themeTaglines = getTaglinesByTheme(options.theme as keyof typeof taglines);
        if (!themeTaglines.length) {
          console.error(pc.red(`❌ Theme '${options.theme}' not found`));
          console.log(pc.yellow("Available themes: " + Object.keys(taglines).join(", ")));
          return;
        }
        
        console.log(pc.cyan(`🎯 Taglines for theme: ${options.theme}`));
        console.log("");
        themeTaglines.forEach((tagline: string, index: number) => {
          console.log(`   ${index + 1}. ${tagline}`);
        });
        
        return;
      }

      if (options.random) {
        const theme = options.random as keyof typeof taglines;
        const randomTagline = getRandomTagline(theme);
        
        if (!randomTagline) {
          console.error(pc.red(`❌ Theme '${theme}' not found`));
          return;
        }
        
        console.log(pc.cyan(`🎲 Random tagline from ${theme}:`));
        console.log(`   "${randomTagline}"`);
        
        return;
      }

      if (options.add) {
        const args = command.args;
        if (args.length < 2) {
          console.error(pc.red("❌ Usage: --add <theme> <tagline>"));
          return;
        }
        
        const theme = args[0] as keyof typeof taglines;
        const tagline = args[1];
        
        addTagline(theme, tagline);
        console.log(pc.green(`✅ Added tagline to ${theme}: "${tagline}"`));
        
        return;
      }

      if (options.remove) {
        const args = command.args;
        if (args.length < 2) {
          console.error(pc.red("❌ Usage: --remove <theme> <tagline>"));
          return;
        }
        
        const theme = args[0] as keyof typeof taglines;
        const tagline = args[1];
        
        const removed = removeTagline(theme, tagline);
        if (removed) {
          console.log(pc.green(`✅ Removed tagline from ${theme}: "${tagline}"`));
        } else {
          console.error(pc.red(`❌ Tagline not found in ${theme}: "${tagline}"`));
        }
        
        return;
      }

      if (options.count) {
        console.log(pc.cyan("📊 Tagline counts:"));
        console.log("");
        
        Object.entries(taglines).forEach(([theme, themeTaglines]) => {
          console.log(`   ${pc.bold(theme)}: ${themeTaglines.length} taglines`);
        });
        
        const total = getAllTaglines().length;
        console.log(`   ${pc.bold("Total")}: ${total} taglines`);
        
        return;
      }

      // Default: show random tagline from default theme
      const randomTagline = getRandomTagline("default");
      console.log(pc.cyan("🎲 Random tagline:"));
      console.log(`   "${randomTagline}"`);

    } catch (error) {
      console.error(pc.red("❌ Taglines command failed:"), error);
    }
  });

// ── Export Command ────────────────────────────────────────
export { taglinesCmd as taglinesCommand };
