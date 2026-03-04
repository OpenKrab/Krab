// ============================================================
// 🦀 Krab — Banner CLI Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { showBanner, bannerThemes } from "../utils/banner.js";

// ── Banner Command ────────────────────────────────────────
export const bannerCmd = new Command("banner")
  .description("Manage Krab banner display")
  .option("-t, --theme <theme>", "Banner theme (default, minimal, professional, playful, tech)", "default")
  .option("-l, --list", "List available themes")
  .option("-p, --preview <theme>", "Preview specific theme")
  .action(async (options) => {
    try {
      if (options.list) {
        console.log(pc.cyan("🎨 Available Banner Themes:"));
        console.log("");
        
        Object.entries(bannerThemes).forEach(([key, theme]) => {
          console.log(`${pc.bold(key)}:`);
          console.log(`   Title: ${theme.title}`);
          console.log(`   Subtitle: ${theme.subtitle}`);
          console.log(`   Taglines: ${theme.taglines.length} options`);
          console.log(`   Color: ${theme.borderColor}`);
          console.log("");
        });
        
        return;
      }

      if (options.preview) {
        const theme = bannerThemes[options.preview as keyof typeof bannerThemes];
        if (!theme) {
          console.error(pc.red(`❌ Theme '${options.preview}' not found`));
          console.log(pc.yellow("Available themes: " + Object.keys(bannerThemes).join(", ")));
          return;
        }
        
        console.log(pc.cyan(`🎨 Previewing theme: ${options.preview}`));
        showBanner(theme);
        return;
      }

      // Show banner with selected theme
      const theme = bannerThemes[options.theme as keyof typeof bannerThemes];
      if (theme) {
        showBanner(theme);
      } else {
        showBanner();
      }

    } catch (error) {
      console.error(pc.red("❌ Banner command failed:"), error);
    }
  });

// ── Export Command ────────────────────────────────────────
export { bannerCmd as bannerCommand };
