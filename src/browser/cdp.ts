// ============================================================
// 🦀 Krab — Browser Control via CDP
// Chrome DevTools Protocol for browser automation
// ============================================================
import { ChromeLauncher } from "../utils/chrome-launcher.js";
import { logger } from "../utils/logger.js";
import type { Browser, Page, CDPSession } from "puppeteer-core";

export interface CDPBrowserOptions {
  headless?: boolean;
  port?: number;
  userDataDir?: string;
  args?: string[];
  executablePath?: string;
}

export interface CDPBrowserSession {
  id: string;
  page: Page;
  cdp: CDPSession;
  createdAt: Date;
}

export class CDPBrowserControl {
  private browser: Browser | null = null;
  private sessions = new Map<string, CDPBrowserSession>();
  private options: CDPBrowserOptions;
  private defaultPort: number;

  constructor(options: CDPBrowserOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      port: options.port || 9222,
      args: options.args || [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    };
    this.defaultPort = this.options.port!;
  }

  async start(): Promise<void> {
    try {
      // Use puppeteer-core for CDP connection
      const puppeteer = await import("puppeteer-core");
      
      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        executablePath: this.options.executablePath,
        args: this.options.args,
        defaultViewport: { width: 1280, height: 720 },
      });
      
      logger.info("[CDP] Browser started");
    } catch (error) {
      logger.error("[CDP] Failed to start browser:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.browser) {
      // Close all sessions
      for (const session of this.sessions.values()) {
        await session.page.close().catch(() => {});
      }
      this.sessions.clear();
      
      await this.browser.close();
      this.browser = null;
      logger.info("[CDP] Browser stopped");
    }
  }

  async createSession(userDataDir?: string): Promise<CDPBrowserSession> {
    if (!this.browser) {
      throw new Error("Browser not started");
    }

    const page = await this.browser.newPage();
    const cdp = await page.target().createCDPSession();
    
    const session: CDPBrowserSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      page,
      cdp,
      createdAt: new Date(),
    };
    
    this.sessions.set(session.id, session);
    logger.info(`[CDP] Created session: ${session.id}`);
    
    return session;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.page.close().catch(() => {});
      this.sessions.delete(sessionId);
      logger.info(`[CDP] Closed session: ${sessionId}`);
    }
  }

  getSession(sessionId: string): CDPBrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): CDPBrowserSession[] {
    return Array.from(this.sessions.values());
  }

  // ── CDP Commands ───────────────────────────────────────────

  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.page.goto(url, { waitUntil: "networkidle0" });
    logger.debug(`[CDP] Navigated to: ${url}`);
  }

  async execute(sessionId: string, script: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    return session.page.evaluate(script);
  }

  async screenshot(sessionId: string, options?: {
    fullPage?: boolean;
    type?: "png" | "jpeg";
    quality?: number;
  }): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    return session.page.screenshot({
      fullPage: options?.fullPage ?? false,
      type: options?.type ?? "png",
      quality: options?.quality,
    }) as Promise<Buffer>;
  }

  async click(sessionId: string, selector: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.page.click(selector);
  }

  async type(sessionId: string, selector: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.page.type(selector, text);
  }

  async select(sessionId: string, selector: string, value: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.page.select(selector, value);
  }

  async waitForSelector(sessionId: string, selector: string, options?: { timeout?: number }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.page.waitForSelector(selector, { timeout: options?.timeout ?? 30000 });
  }

  async getHTML(sessionId: string, selector?: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    if (selector) {
      return session.page.$eval(selector, (el) => el.innerHTML);
    }
    return session.page.content();
  }

  async getCookies(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    return session.page.cookies();
  }

  async setCookies(sessionId: string, cookies: Array<{ name: string; value: string; domain?: string; path?: string }>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.page.setCookie(...cookies);
  }

  async clearCookies(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    const cookies = await session.page.cookies();
    await session.page.deleteCookie(...cookies);
  }

  // ── Network Interception ─────────────────────────────────────

  async enableNetworkInterception(sessionId: string, callback: (params: unknown) => void): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.cdp.send("Network.enable");
    session.cdp.on("Network.requestWillBeSent", callback);
  }

  async disableNetworkInterception(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    await session.cdp.send("Network.disable");
  }

  // ── Console Capture ────────────────────────────────────────

  async captureConsole(sessionId: string, callback: (entry: any) => void): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    session.page.on("console", (msg) => {
      callback({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    });
  }

  // ── PDF Generation ─────────────────────────────────────────

  async printToPDF(sessionId: string, options?: {
    scale?: number;
    printBackground?: boolean;
    format?: string;
    margin?: { top?: string; bottom?: string; left?: string; right?: string };
  }): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    return session.page.pdf({
      scale: options?.scale ?? 1,
      printBackground: options?.printBackground ?? true,
      format: options?.format ?? "A4",
      margin: options?.margin,
    }) as Promise<Buffer>;
  }
}

// ── Singleton ───────────────────────────────────────────────
let cdpBrowserInstance: CDPBrowserControl | null = null;

export function getCDPBrowser(options?: CDPBrowserOptions): CDPBrowserControl {
  if (!cdpBrowserInstance) {
    cdpBrowserInstance = new CDPBrowserControl(options);
  }
  return cdpBrowserInstance;
}

export async function startCDPBrowser(options?: CDPBrowserOptions): Promise<CDPBrowserControl> {
  const browser = getCDPBrowser(options);
  await browser.start();
  return browser;
}
