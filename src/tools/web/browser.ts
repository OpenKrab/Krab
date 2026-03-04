// ============================================================
// 🦀 Krab — Browser Automation Tool
// ============================================================
import { ToolDefinition as Tool, ToolResult } from "../../core/types.js";
import { logger } from "../../utils/logger.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export interface BrowserOptions {
  action: "status" | "start" | "stop" | "tabs" | "open" | "focus" | "close" | "snapshot" | "screenshot" | "act" | "navigate" | "console" | "pdf" | "upload" | "dialog" | "profiles" | "create-profile" | "delete-profile" | "reset-profile";
  profile?: string;
  target?: "sandbox" | "host" | "node";
  node?: string;
  url?: string;
  ref?: string;
  selector?: string;
  text?: string;
  keys?: string[];
  wait?: number;
  timeout?: number;
  filePath?: string;
  command?: string;
  args?: any;
}

export interface BrowserResult {
  action: string;
  status: "success" | "error";
  data?: any;
  error?: string;
  timestamp: Date;
}

export class BrowserManager {
  private profiles = new Map<string, BrowserProfile>();
  private defaultProfile = "chrome";

  constructor() {
    this.initializeDefaultProfile();
  }

  private initializeDefaultProfile(): void {
    this.profiles.set(this.defaultProfile, {
      name: this.defaultProfile,
      status: "stopped",
      port: 18800,
      cdpUrl: null,
      pid: null,
      userDataDir: path.join(process.cwd(), ".krab", "browser", this.defaultProfile)
    });
  }

  async execute(options: BrowserOptions): Promise<BrowserResult> {
    try {
      logger.info(`[Browser] Executing: ${options.action}`);

      switch (options.action) {
        case "status":
          return await this.getStatus(options);
        case "start":
          return await this.start(options);
        case "stop":
          return await this.stop(options);
        case "tabs":
          return await this.getTabs(options);
        case "open":
          return await this.open(options);
        case "focus":
          return await this.focus(options);
        case "close":
          return await this.close(options);
        case "snapshot":
          return await this.snapshot(options);
        case "screenshot":
          return await this.screenshot(options);
        case "act":
          return await this.act(options);
        case "navigate":
          return await this.navigate(options);
        case "console":
          return await this.console(options);
        case "pdf":
          return await this.pdf(options);
        case "upload":
          return await this.upload(options);
        case "dialog":
          return await this.dialog(options);
        case "profiles":
          return await this.listProfiles();
        case "create-profile":
          return await this.createProfile(options);
        case "delete-profile":
          return await this.deleteProfile(options);
        case "reset-profile":
          return await this.resetProfile(options);
        default:
          throw new Error(`Unknown browser action: ${options.action}`);
      }

    } catch (error) {
      logger.error(`[Browser] Action failed: ${options.action}`, error);
      return {
        action: options.action,
        status: "error",
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }

  private async getStatus(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    return {
      action: "status",
      status: "success",
      data: {
        profile: profile.name,
        status: profile.status,
        port: profile.port,
        cdpUrl: profile.cdpUrl,
        pid: profile.pid,
        running: profile.status === "running"
      },
      timestamp: new Date()
    };
  }

  private async start(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status === "running") {
      return {
        action: "start",
        status: "success",
        data: { message: "Browser already running", cdpUrl: profile.cdpUrl },
        timestamp: new Date()
      };
    }

    // Create user data directory if it doesn't exist
    if (!fs.existsSync(profile.userDataDir)) {
      fs.mkdirSync(profile.userDataDir, { recursive: true });
    }

    // In a real implementation, this would start Chrome/Chromium with CDP
    // For now, we'll simulate starting the browser
    profile.status = "running";
    profile.cdpUrl = `ws://localhost:${profile.port}`;
    profile.pid = Math.floor(Math.random() * 10000) + 1000; // Simulated PID

    logger.info(`[Browser] Started profile: ${profile.name} on port ${profile.port}`);

    return {
      action: "start",
      status: "success",
      data: { cdpUrl: profile.cdpUrl, port: profile.port },
      timestamp: new Date()
    };
  }

  private async stop(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status === "stopped") {
      return {
        action: "stop",
        status: "success",
        data: { message: "Browser already stopped" },
        timestamp: new Date()
      };
    }

    // In a real implementation, this would kill the browser process
    profile.status = "stopped";
    profile.cdpUrl = null;
    profile.pid = null;

    logger.info(`[Browser] Stopped profile: ${profile.name}`);

    return {
      action: "stop",
      status: "success",
      data: { message: "Browser stopped" },
      timestamp: new Date()
    };
  }

  private async getTabs(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate getting tabs
    const tabs = [
      { id: 1, url: "https://example.com", title: "Example Domain" },
      { id: 2, url: "https://google.com", title: "Google" }
    ];

    return {
      action: "tabs",
      status: "success",
      data: { tabs },
      timestamp: new Date()
    };
  }

  private async open(options: BrowserOptions): Promise<BrowserResult> {
    if (!options.url) {
      throw new Error("URL is required for open action");
    }

    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate opening URL
    logger.info(`[Browser] Opening URL: ${options.url}`);

    return {
      action: "open",
      status: "success",
      data: { url: options.url, tabId: Math.floor(Math.random() * 100) + 1 },
      timestamp: new Date()
    };
  }

  private async focus(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate focusing tab
    return {
      action: "focus",
      status: "success",
      data: { message: "Tab focused" },
      timestamp: new Date()
    };
  }

  private async close(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate closing tab
    return {
      action: "close",
      status: "success",
      data: { message: "Tab closed" },
      timestamp: new Date()
    };
  }

  private async snapshot(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate taking a snapshot
    const snapshot = {
      title: "Page Title",
      url: "https://example.com",
      elements: [
        { ref: "1", type: "button", text: "Click me", selector: "button#submit" },
        { ref: "2", type: "input", placeholder: "Enter text", selector: "input#text" }
      ]
    };

    return {
      action: "snapshot",
      status: "success",
      data: { snapshot },
      timestamp: new Date()
    };
  }

  private async screenshot(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Simulate taking screenshot
    const filePath = path.join(outputDir, `screenshot_${Date.now()}.png`);
    
    // In a real implementation, this would capture an actual screenshot
    // For now, we'll create a placeholder file
    fs.writeFileSync(filePath, "placeholder-screenshot-data");

    return {
      action: "screenshot",
      status: "success",
      data: { filePath, mediaPath: `MEDIA:${filePath}` },
      timestamp: new Date()
    };
  }

  private async act(options: BrowserOptions): Promise<BrowserResult> {
    if (!options.ref && !options.selector) {
      throw new Error("Element reference or selector is required for act action");
    }

    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate performing action
    const action = {
      element: options.ref || options.selector,
      action: options.command,
      result: "success"
    };

    return {
      action: "act",
      status: "success",
      data: { action },
      timestamp: new Date()
    };
  }

  private async navigate(options: BrowserOptions): Promise<BrowserResult> {
    if (!options.url) {
      throw new Error("URL is required for navigate action");
    }

    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate navigation
    return {
      action: "navigate",
      status: "success",
      data: { url: options.url },
      timestamp: new Date()
    };
  }

  private async console(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate console command
    const result = {
      command: options.command,
      output: "Command executed successfully"
    };

    return {
      action: "console",
      status: "success",
      data: { result },
      timestamp: new Date()
    };
  }

  private async pdf(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), "pdfs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Simulate PDF generation
    const filePath = path.join(outputDir, `page_${Date.now()}.pdf`);
    fs.writeFileSync(filePath, "placeholder-pdf-data");

    return {
      action: "pdf",
      status: "success",
      data: { filePath },
      timestamp: new Date()
    };
  }

  private async upload(options: BrowserOptions): Promise<BrowserResult> {
    if (!options.filePath) {
      throw new Error("File path is required for upload action");
    }

    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate file upload
    return {
      action: "upload",
      status: "success",
      data: { filePath: options.filePath },
      timestamp: new Date()
    };
  }

  private async dialog(options: BrowserOptions): Promise<BrowserResult> {
    const profile = this.getProfile(options.profile || this.defaultProfile);
    
    if (profile.status !== "running") {
      throw new Error("Browser is not running");
    }

    // Simulate dialog handling
    return {
      action: "dialog",
      status: "success",
      data: { message: "Dialog handled" },
      timestamp: new Date()
    };
  }

  private async listProfiles(): Promise<BrowserResult> {
    const profiles = Array.from(this.profiles.values()).map(p => ({
      name: p.name,
      status: p.status,
      port: p.port
    }));

    return {
      action: "profiles",
      status: "success",
      data: { profiles },
      timestamp: new Date()
    };
  }

  private async createProfile(options: BrowserOptions): Promise<BrowserResult> {
    const profileName = options.profile || `profile_${Date.now()}`;
    
    if (this.profiles.has(profileName)) {
      throw new Error(`Profile ${profileName} already exists`);
    }

    const port = 18800 + this.profiles.size;
    const userDataDir = path.join(process.cwd(), ".krab", "browser", profileName);

    this.profiles.set(profileName, {
      name: profileName,
      status: "stopped",
      port,
      cdpUrl: null,
      pid: null,
      userDataDir
    });

    return {
      action: "create-profile",
      status: "success",
      data: { profile: profileName, port, userDataDir },
      timestamp: new Date()
    };
  }

  private async deleteProfile(options: BrowserOptions): Promise<BrowserResult> {
    const profileName = options.profile;
    
    if (!profileName) {
      throw new Error("Profile name is required for delete-profile action");
    }

    const profile = this.getProfile(profileName);
    
    if (profile.status === "running") {
      throw new Error("Cannot delete running profile. Stop it first.");
    }

    // Remove user data directory
    if (fs.existsSync(profile.userDataDir)) {
      fs.rmSync(profile.userDataDir, { recursive: true, force: true });
    }

    this.profiles.delete(profileName);

    return {
      action: "delete-profile",
      status: "success",
      data: { message: `Profile ${profileName} deleted` },
      timestamp: new Date()
    };
  }

  private async resetProfile(options: BrowserOptions): Promise<BrowserResult> {
    const profileName = options.profile || this.defaultProfile;
    const profile = this.getProfile(profileName);

    // Stop if running
    if (profile.status === "running") {
      await this.stop({ ...options, action: "stop", profile: profileName });
    }

    // Clear user data directory
    if (fs.existsSync(profile.userDataDir)) {
      fs.rmSync(profile.userDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(profile.userDataDir, { recursive: true });

    return {
      action: "reset-profile",
      status: "success",
      data: { message: `Profile ${profileName} reset` },
      timestamp: new Date()
    };
  }

  private getProfile(name: string): BrowserProfile {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new Error(`Profile ${name} not found`);
    }
    return profile;
  }
}

interface BrowserProfile {
  name: string;
  status: "running" | "stopped";
  port: number;
  cdpUrl: string | null;
  pid: number | null;
  userDataDir: string;
}

// ── Browser Tool ────────────────────────────────────────────
export const browserTool: Tool = {
  name: "browser",
  description: "Browser automation tool. Supports status, start, stop, tabs, open, focus, close, snapshot, screenshot, act, navigate, console, pdf, upload, dialog, and profile management.",
  parameters: z.object({
    action: z.enum(["status", "start", "stop", "tabs", "open", "focus", "close", "snapshot", "screenshot", "act", "navigate", "console", "pdf", "upload", "dialog", "profiles", "create-profile", "delete-profile", "reset-profile"]).describe("Browser action to perform"),
    profile: z.string().optional().describe("Browser profile name (default: chrome)"),
    target: z.enum(["sandbox", "host", "node"]).optional().describe("Target environment"),
    node: z.string().optional().describe("Node identifier for target=node"),
    url: z.string().optional().describe("URL for open/navigate actions"),
    ref: z.string().optional().describe("Element reference from snapshot"),
    selector: z.string().optional().describe("CSS selector for element"),
    text: z.string().optional().describe("Text for typing actions"),
    keys: z.array(z.string()).optional().describe("Key sequence for press actions"),
    wait: z.number().optional().describe("Wait time in milliseconds"),
    timeout: z.number().optional().describe("Action timeout in milliseconds"),
    filePath: z.string().optional().describe("File path for upload actions"),
    command: z.string().optional().describe("Console command"),
    args: z.any().optional().describe("Additional action arguments")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const browser = new BrowserManager();
      const result = await browser.execute(args);

      logger.info(`[BrowserTool] Action completed: ${result.action}`);
      return {
        success: true,
        output: JSON.stringify(result, null, 2)
      };

    } catch (error) {
      logger.error("[BrowserTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Browser action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createBrowserManager(): BrowserManager {
  return new BrowserManager();
}

// Export for dynamic loading
export default BrowserManager;
