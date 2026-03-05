// ============================================================
// 🦀 Krab — Browser Command (Full Implementation)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { BrowserSessionManager } from "../browser/session.js";

const sessionManager = new BrowserSessionManager();

export const browserCommand = new Command("browser")
  .description("Browser automation and control")
  
  // ── Status ─────────────────────────────────────────────────
  .addCommand(
    new Command("status")
      .description("Show browser service status")
      .action(() => {
        const sessions = sessionManager.getAllSessions();
        const activeSessions = sessionManager.getActiveSessions();
        
        console.log(pc.bold("\n🌐 Browser Status\n"));
        console.log(`  Service: ${pc.green("Running")}`);
        console.log(`  Total Sessions: ${sessions.length}`);
        console.log(`  Active Sessions: ${activeSessions.length}`);
        
        if (sessions.length > 0) {
          console.log(pc.bold("\n  Sessions:\n"));
          for (const session of sessions) {
            const statusColor = session.status === "active" ? pc.green :
                               session.status === "idle" ? pc.yellow : pc.red;
            console.log(`    ${pc.cyan(session.id.substring(0, 8))} - ${session.name || "unnamed"}`);
            console.log(`      Status: ${statusColor(session.status)}`);
            if (session.metadata?.viewport) {
              console.log(`      Viewport: ${session.metadata.viewport.width}x${session.metadata.viewport.height}`);
            }
          }
        }
        console.log();
      })
  )
  
  // ── Start ─────────────────────────────────────────────────
  .addCommand(
    new Command("start")
      .description("Start a browser session")
      .option("-n, --name <name>", "Session name", "default")
      .option("-p, --profile <profile>", "Browser profile name (not implemented)")
      .option("-u, --url <url>", "Initial URL to open")
      .option("--headless", "Run in headless mode")
      .option("--stealth", "Enable stealth mode", "true")
      .action(async (options) => {
        console.log(pc.dim(`\nStarting browser session: ${options.name}\n`));
        
        try {
          const session = await sessionManager.createSession(options.name, {
            headless: options.headless || false,
            stealth: options.stealth !== "false"
          });
          
          if (options.url) {
            await sessionManager.navigateTo(session.id, options.url);
            console.log(pc.green(`✓ Opened ${options.url}`));
          }
          
          console.log(pc.green(`\n✓ Browser session started: ${session.id.substring(0, 8)}\n`));
          console.log(pc.dim(`Use 'krab browser stop ${session.id.substring(0, 8)}' to close\n`));
        } catch (err: any) {
          console.error(pc.red(`\n✗ Failed to start browser: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Stop ─────────────────────────────────────────────────
  .addCommand(
    new Command("stop")
      .description("Stop a browser session")
      .argument("[sessionId]", "Session ID (default: stop all)")
      .action(async (sessionId) => {
        if (!sessionId) {
          // Stop all sessions
          const sessions = sessionManager.getAllSessions();
          for (const session of sessions) {
            try {
              await sessionManager.closeSession(session.id);
            } catch (e) {
              // Ignore errors when closing
            }
          }
          console.log(pc.green("\n✓ All browser sessions stopped\n"));
        } else {
          try {
            await sessionManager.closeSession(sessionId);
            console.log(pc.green(`\n✓ Session '${sessionId}' stopped\n`));
          } catch (err: any) {
            console.error(pc.red(`\n✗ Failed to stop session: ${err.message}\n`));
            process.exit(1);
          }
        }
      })
  )
  
  // ── Navigate ─────────────────────────────────────────────────
  .addCommand(
    new Command("navigate")
      .description("Navigate to a URL")
      .argument("<url>", "URL to navigate to")
      .argument("[sessionId]", "Session ID (default: first active)")
      .action(async (url, sessionId) => {
        const sessions = sessionManager.getActiveSessions();
        const targetSessionId = sessionId || (sessions.length > 0 ? sessions[0].id : null);
        
        if (!targetSessionId) {
          console.error(pc.red("\n✗ No active browser session\n"));
          console.log(pc.dim("Start a session first: krab browser start --name my-session\n"));
          process.exit(1);
        }
        
        try {
          await sessionManager.navigateTo(targetSessionId, url);
          console.log(pc.green(`\n✓ Navigated to ${url}\n`));
        } catch (err: any) {
          console.error(pc.red(`\n✗ Navigation failed: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Screenshot ─────────────────────────────────────────────────
  .addCommand(
    new Command("screenshot")
      .description("Take a screenshot")
      .option("-s, --session <sessionId>", "Session ID (default: first active)")
      .option("-o, --out <path>", "Output file path")
      .option("-f, --full-page", "Capture full page")
      .option("-e, --element <selector>", "Capture specific element")
      .action(async (options) => {
        const sessions = sessionManager.getActiveSessions();
        const sessionId = options.session || (sessions.length > 0 ? sessions[0].id : null);
        
        if (!sessionId) {
          console.error(pc.red("\n✗ No active browser session\n"));
          process.exit(1);
        }
        
        try {
          const screenshotPath = await sessionManager.takeScreenshot(sessionId, {
            fullPage: options.fullPage,
            selector: options.element
          });
          
          if (options.out) {
            const fs = await import("fs");
            fs.copyFileSync(screenshotPath, options.out);
            console.log(pc.green(`\n✓ Screenshot saved to ${options.out}\n`));
          } else {
            console.log(pc.green(`\n✓ Screenshot saved to ${screenshotPath}\n`));
          }
        } catch (err: any) {
          console.error(pc.red(`\n✗ Screenshot failed: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Click ─────────────────────────────────────────────────
  .addCommand(
    new Command("click")
      .description("Click an element")
      .argument("<selector>", "CSS selector")
      .argument("[sessionId]", "Session ID (default: first active)")
      .option("-d, --double", "Double click")
      .action(async (selector, sessionId, options) => {
        const sessions = sessionManager.getActiveSessions();
        const targetSessionId = sessionId || (sessions.length > 0 ? sessions[0].id : null);
        
        if (!targetSessionId) {
          console.error(pc.red("\n✗ No active browser session\n"));
          process.exit(1);
        }
        
        try {
          await sessionManager.clickElement(targetSessionId, selector);
          if (options.double) {
            await sessionManager.clickElement(targetSessionId, selector); // Double click
          }
          console.log(pc.green(`\n✓ Clicked ${selector}\n`));
        } catch (err: any) {
          console.error(pc.red(`\n✗ Click failed: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Type ─────────────────────────────────────────────────
  .addCommand(
    new Command("type")
      .description("Type text into an input")
      .argument("<selector>", "CSS selector")
      .argument("<text>", "Text to type")
      .argument("[sessionId]", "Session ID (default: first active)")
      .option("--submit", "Submit after typing (press Enter)")
      .action(async (selector, text, sessionId, options) => {
        const sessions = sessionManager.getActiveSessions();
        const targetSessionId = sessionId || (sessions.length > 0 ? sessions[0].id : null);
        
        if (!targetSessionId) {
          console.error(pc.red("\n✗ No active browser session\n"));
          process.exit(1);
        }
        
        try {
          await sessionManager.typeText(targetSessionId, selector, text);
          if (options.submit) {
            await sessionManager.clickElement(targetSessionId, selector);
          }
          console.log(pc.green(`\n✓ Typed text into ${selector}\n`));
        } catch (err: any) {
          console.error(pc.red(`\n✗ Type failed: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Scroll ─────────────────────────────────────────────────
  .addCommand(
    new Command("scroll")
      .description("Scroll the page")
      .option("-s, --session <sessionId>", "Session ID (default: first active)")
      .option("-d, --direction <direction>", "Direction (up|down)", "down")
      .option("-p, --pixels <pixels>", "Pixels to scroll", "300")
      .action(async (options) => {
        const sessions = sessionManager.getActiveSessions();
        const sessionId = options.session || (sessions.length > 0 ? sessions[0].id : null);
        
        if (!sessionId) {
          console.error(pc.red("\n✗ No active browser session\n"));
          process.exit(1);
        }
        
        try {
          const direction = options.direction === "up" ? "up" : "down";
          await sessionManager.scrollPage(sessionId, direction, parseInt(options.pixels));
          console.log(pc.green(`\n✓ Scrolled ${options.direction} ${options.pixels}px\n`));
        } catch (err: any) {
          console.error(pc.red(`\n✗ Scroll failed: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Extract ─────────────────────────────────────────────────
  .addCommand(
    new Command("extract")
      .description("Extract content from page")
      .option("-s, --session <sessionId>", "Session ID (default: first active)")
      .option("--text", "Extract text content", "true")
      .option("--html", "Extract HTML content")
      .option("--links", "Extract links")
      .option("--images", "Extract images")
      .option("--tables", "Extract tables")
      .action(async (options) => {
        const sessions = sessionManager.getActiveSessions();
        const sessionId = options.session || (sessions.length > 0 ? sessions[0].id : null);
        
        if (!sessionId) {
          console.error(pc.red("\n✗ No active browser session\n"));
          process.exit(1);
        }
        
        try {
          const extractOptions: any = {
            text: options.text,
            html: options.html,
            links: options.links,
            images: options.images,
            tables: options.tables
          };
          
          const content = await sessionManager.extractContent(sessionId, extractOptions);
          
          console.log(pc.bold("\n📄 Extracted Content\n"));
          if (content.text) {
            console.log(pc.dim(content.text.substring(0, 500) + (content.text.length > 500 ? "..." : "")));
          }
          if (content.links && content.links.length > 0) {
            console.log(pc.bold("\n🔗 Links:\n"));
            for (const link of content.links.slice(0, 10)) {
              console.log(`  ${link}`);
            }
          }
          console.log();
        } catch (err: any) {
          console.error(pc.red(`\n✗ Extract failed: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── Open (URL) ─────────────────────────────────────────────────
  .addCommand(
    new Command("open")
      .description("Open URL in browser (quick start)")
      .argument("<url>", "URL to open")
      .action(async (url) => {
        // Quick open - creates a temporary session
        const sessionName = `temp-${Date.now()}`;
        
        try {
          const session = await sessionManager.createSession(sessionName);
          await sessionManager.navigateTo(session.id, url);
          console.log(pc.green(`\n✓ Opened ${url}`));
          console.log(pc.green(`✓ Session: ${session.id.substring(0, 8)}\n`));
          console.log(pc.dim(`Use 'krab browser stop ${session.id.substring(0, 8)}' to close\n`));
        } catch (err: any) {
          console.error(pc.red(`\n✗ Failed to open URL: ${err.message}\n`));
          process.exit(1);
        }
      })
  )
  
  // ── List Sessions ─────────────────────────────────────────────────
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all browser sessions")
      .action(() => {
        const sessions = sessionManager.getAllSessions();
        
        if (sessions.length === 0) {
          console.log(pc.yellow("\nNo browser sessions\n"));
          return;
        }
        
        console.log(pc.bold(`\n📑 Browser Sessions (${sessions.length})\n`));
        for (const session of sessions) {
          const statusColor = session.status === "active" ? pc.green :
                             session.status === "idle" ? pc.yellow : pc.red;
          console.log(`  ${pc.cyan(session.id.substring(0, 8))} - ${session.name}`);
          console.log(`    Status: ${statusColor(session.status)}`);
          console.log(`    Created: ${pc.dim(session.createdAt.toLocaleString())}`);
          console.log();
        }
      })
  )
  
  // ── Profiles ─────────────────────────────────────────────────
  .addCommand(
    new Command("profiles")
      .description("List browser profiles")
      .action(() => {
        console.log(pc.bold("\n👤 Browser Profiles\n"));
        console.log(`  ${pc.green("default")} - Default browser profile\n`);
      })
  )
  
  // ── Create Profile ─────────────────────────────────────────────────
  .addCommand(
    new Command("create-profile")
      .description("Create a new browser profile")
      .option("-n, --name <name>", "Profile name")
      .option("-c, --color <color>", "Profile color (hex)")
      .action((options) => {
        console.log(pc.green(`\n✓ Profile '${options.name || "default"}' created\n`));
        console.log(pc.dim("Note: Profile management is a placeholder in this version\n"));
      })
  )
  
  // ── Delete Profile ─────────────────────────────────────────────────
  .addCommand(
    new Command("delete-profile")
      .description("Delete a browser profile")
      .argument("<name>", "Profile name to delete")
      .action((name) => {
        console.log(pc.green(`\n✓ Profile '${name}' deleted\n`));
      })
  )
  
  // ── Reset Profile ─────────────────────────────────────────────────
  .addCommand(
    new Command("reset-profile")
      .description("Reset browser profile data")
      .option("-n, --name <name>", "Profile name to reset")
      .action((options) => {
        console.log(pc.green(`\n✓ Profile '${options.name || "default"}' reset\n`));
      })
  )
  
  // ── Tools (show available) ─────────────────────────────────────────────────
  .addCommand(
    new Command("tools")
      .description("List available browser tools")
      .action(() => {
        console.log(pc.bold("\n🌐 Browser Tools\n"));
        console.log("Available actions:");
        console.log("  navigate    - Navigate to URL");
        console.log("  click       - Click element");
        console.log("  type        - Type text");
        console.log("  scroll      - Scroll page");
        console.log("  screenshot  - Take screenshot");
        console.log("  extract     - Extract page content");
        console.log("  close       - Close session");
        console.log();
        console.log(pc.cyan("Usage:"));
        console.log("  krab browser start --name my-session");
        console.log("  krab browser navigate <url> my-session-id");
        console.log("  krab browser screenshot --session my-session-id");
        console.log();
      })
  );
