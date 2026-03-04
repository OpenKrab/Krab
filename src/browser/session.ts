// ============================================================
// 🦀 Krab — Browser Session Manager
// ============================================================
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface BrowserSession {
  id: string;
  name: string;
  browser: Browser;
  context?: BrowserContext;
  page?: Page;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'idle' | 'closed';
  metadata?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    stealth?: boolean;
  };
}

export interface BrowserOptions {
  headless?: boolean;
  stealth?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  timeout?: number;
  slowMo?: number;
}

export class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>();
  private defaultOptions: BrowserOptions = {
    headless: false,
    stealth: true,
    viewport: { width: 1920, height: 1080 },
    timeout: 30000,
    slowMo: 0
  };

  constructor() {
    this.cleanupOnExit();
  }

  async createSession(name: string, options: BrowserOptions = {}): Promise<BrowserSession> {
    const sessionId = uuidv4();
    const mergedOptions = { ...this.defaultOptions, ...options };

    logger.info(`[BrowserSession] Creating session: ${name} (${sessionId})`);

    try {
      const browser = await chromium.launch(mergedOptions);
      const context = await browser.newContext({
        ...mergedOptions,
        recordVideo: {
          dir: path.join(process.cwd(), 'browser-recordings'),
          size: { width: 1920, height: 1080 }
        }
      });
      const page = await context.newPage();

      const session: BrowserSession = {
        id: sessionId,
        name,
        browser,
        context,
        page,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active',
        metadata: mergedOptions
      };

      this.sessions.set(sessionId, session);

      // Setup page event handlers
      await this.setupPageHandlers(page, sessionId);

      logger.info(`[BrowserSession] Session created: ${sessionId}`);
      return session;

    } catch (error) {
      logger.error(`[BrowserSession] Failed to create session ${name}:`, error);
      throw error;
    }
  }

  private async setupPageHandlers(page: Page, sessionId: string): Promise<void> {
    // Handle console logs
    page.on('console', (msg) => {
      logger.info(`[BrowserSession:${sessionId}] Console:`, msg);
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      logger.error(`[BrowserSession:${sessionId}] Page error:`, error);
    });

    // Handle request failures
    page.on('requestfailed', (request) => {
      logger.error(`[BrowserSession:${sessionId}] Request failed:`, request.url(), request.failure().errorText());
    });

    // Set default user agent and stealth
    await page.setUserAgent(this.defaultOptions.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
      // Add stealth scripts
      page.addStyleTag({
        content: `
          /* Hide automation indicators */
          .automation-styles { display: none !important; }
          .webdriver-styles { display: none !important; }
        `
      });
    });
  }

  async navigateTo(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Navigating to: ${url}`);
    
    try {
      await session.page.goto(url, { waitUntil: 'networkidle' });
      session.lastActivity = new Date();
      
      // Take screenshot after navigation
      const screenshot = await session.page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      const screenshotPath = path.join(process.cwd(), 'browser-screenshots', `${sessionId}-${Date.now()}.png`);
      fs.writeFileSync(screenshotPath, screenshot);
      
      logger.info(`[BrowserSession:${sessionId}] Screenshot saved: ${screenshotPath}`);
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Navigation failed:`, error);
      throw error;
    }
  }

  async clickElement(sessionId: string, selector: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Clicking element: ${selector}`);
    
    try {
      await session.page.waitForSelector(selector, { timeout: 5000 });
      await session.page.click(selector);
      session.lastActivity = new Date();
      
      // Take screenshot after click
      const screenshot = await session.page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      const screenshotPath = path.join(process.cwd(), 'browser-screenshots', `${sessionId}-click-${Date.now()}.png`);
      fs.writeFileSync(screenshotPath, screenshot);
      
      logger.info(`[BrowserSession:${sessionId}] Click screenshot saved: ${screenshotPath}`);
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Click failed:`, error);
      throw error;
    }
  }

  async typeText(sessionId: string, selector: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Typing text: ${text} into ${selector}`);
    
    try {
      await session.page.waitForSelector(selector, { timeout: 5000 });
      await session.page.fill(selector, text);
      session.lastActivity = new Date();
      
      // Small delay to simulate typing
      await session.page.waitForTimeout(100 + Math.random() * 200);
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Type failed:`, error);
      throw error;
    }
  }

  async scrollPage(sessionId: string, direction: 'up' | 'down' = 'down', distance: number = 300): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Scrolling ${direction} by ${distance}px`);
    
    try {
      if (direction === 'down') {
        await session.page.mouse.wheel(0, distance);
      } else {
        await session.page.mouse.wheel(0, -distance);
      }
      session.lastActivity = new Date();
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Scroll failed:`, error);
      throw error;
    }
  }

  async takeScreenshot(sessionId: string, options: { fullPage?: boolean; selector?: string } = {}): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Taking screenshot`);
    
    try {
      let screenshot: Buffer;
      
      if (options.selector) {
        await session.page.waitForSelector(options.selector, { timeout: 5000 });
        const element = await session.page.$(options.selector);
        screenshot = await element?.screenshot({ type: 'png' }) || await session.page.screenshot({ type: 'png' });
      } else {
        screenshot = await session.page.screenshot({
          fullPage: options.fullPage !== false,
          type: 'png'
        });
      }
      
      const timestamp = Date.now();
      const filename = `${sessionId}-${options.selector ? 'element-' : ''}screenshot-${timestamp}.png`;
      const screenshotPath = path.join(process.cwd(), 'browser-screenshots', filename);
      
      fs.writeFileSync(screenshotPath, screenshot);
      session.lastActivity = new Date();
      
      logger.info(`[BrowserSession:${sessionId}] Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Screenshot failed:`, error);
      throw error;
    }
  }

  async extractContent(sessionId: string, options: { 
    text?: boolean; 
    html?: boolean; 
    links?: boolean; 
    images?: boolean; 
    tables?: boolean 
  } = {}): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Extracting content`);
    
    try {
      const content = await session.page.evaluate((options) => {
        const result: any = {};
        
        if (options.text) {
          result.text = document.body.innerText;
        }
        
        if (options.html) {
          result.html = document.documentElement.outerHTML;
        }
        
        if (options.links) {
          const links = Array.from(document.querySelectorAll('a')).map((a: any) => ({
            text: a.innerText,
            href: a.href,
            title: a.title
          }));
          result.links = links;
        }
        
        if (options.images) {
          const images = Array.from(document.querySelectorAll('img')).map((img: any) => ({
            src: img.src,
            alt: img.alt,
            title: img.title
          }));
          result.images = images;
        }
        
        if (options.tables) {
          const tables = Array.from(document.querySelectorAll('table')).map((table: any) => {
            const rows = Array.from(table.querySelectorAll('tr')).map((tr: any) => 
              Array.from(tr.querySelectorAll('td')).map((td: any) => td.innerText)
            );
            return {
              headers: rows[0] || [],
              rows: rows.slice(1)
            };
          });
          result.tables = tables;
        }
        
        return result;
      }, options);
      
      session.lastActivity = new Date();
      logger.info(`[BrowserSession:${sessionId}] Content extracted successfully`);
      return content;
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Content extraction failed:`, error);
      throw error;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    logger.info(`[BrowserSession:${sessionId}] Closing session`);
    
    try {
      session.status = 'closed';
      
      if (session.page) {
        await session.page.close();
      }
      
      if (session.context) {
        await session.context.close();
      }
      
      if (session.browser) {
        await session.browser.close();
      }
      
      this.sessions.delete(sessionId);
      
      logger.info(`[BrowserSession:${sessionId}] Session closed successfully`);
      
    } catch (error) {
      logger.error(`[BrowserSession:${sessionId}] Error closing session:`, error);
    }
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === 'active');
  }

  private cleanupOnExit(): void {
    const cleanup = async () => {
      logger.info('[BrowserSession] Cleaning up sessions on exit');
      
      for (const [sessionId, session] of this.sessions.entries()) {
        try {
          await this.closeSession(sessionId);
        } catch (error) {
          logger.error(`[BrowserSession] Error cleaning up session ${sessionId}:`, error);
        }
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}

export { BrowserSession };
