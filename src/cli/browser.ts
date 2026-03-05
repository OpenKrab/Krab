// ============================================================
// 🦀 Krab — Browser Command (Simplified)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";

export const browserCommand = new Command("browser")
  .description("Browser automation commands (requires browser tools)")
  .addCommand(
    new Command("open")
      .description("Open URL in browser (via tool)")
      .argument("<url>", "URL to open")
      .action(async (url) => {
        console.log(pc.yellow("Browser automation is available through tools:"));
        console.log();
        console.log("Use these tools in chat or via 'krab ask':");
        console.log("  • browser_navigate - Navigate to URL");
        console.log("  • browser_screenshot - Take screenshot");
        console.log("  • browser_click - Click elements");
        console.log("  • browser_type - Type text");
        console.log();
        console.log(pc.cyan("Example:"));
        console.log(`  krab ask "Navigate to ${url} and take a screenshot"`);
      })
  )
  .addCommand(
    new Command("tools")
      .description("List available browser tools")
      .action(() => {
        console.log(pc.bold("\n🌐 Browser Tools\n"));
        console.log("Available tools for browser automation:");
        console.log();
        console.log("  browser_navigate");
        console.log("    Navigate to a URL");
        console.log();
        console.log("  browser_screenshot");
        console.log("    Capture page screenshot");
        console.log();
        console.log("  browser_click");
        console.log("    Click on element by selector");
        console.log();
        console.log("  browser_type");
        console.log("    Type text into input field");
        console.log();
        console.log("  browser_get_content");
        console.log("    Extract page content");
        console.log();
        console.log(pc.cyan("Usage:"));
        console.log("  krab ask \"Navigate to example.com\"");
        console.log();
      })
  );
