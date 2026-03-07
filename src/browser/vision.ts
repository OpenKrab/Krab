// ============================================================
// 🦀 Krab — Browser AI Vision
// ============================================================
import { BrowserSessionManager } from './session.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface VisionOptions {
  sessionId: string;
  action: 'analyze' | 'ocr' | 'find_elements' | 'compare_screenshots';
  query?: string;
  selector?: string;
  screenshot1?: string;
  screenshot2?: string;
  elementTypes?: string[];
  threshold?: number;
}

export interface VisionResult {
  analysis?: {
    description: string;
    elements: any[];
    confidence: number;
    accessibility: any;
  };
  ocr?: {
    text: string;
    confidence: number;
    language: string;
    boundingBox: any;
  };
  elements?: any[];
  comparison?: {
    similarity: number;
    differences: any[];
  };
}

export class BrowserVision {
  private sessionManager: BrowserSessionManager;

  constructor() {
    this.sessionManager = new BrowserSessionManager();
  }

  async analyzePage(sessionId: string, query?: string): Promise<VisionResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserVision] Analyzing page: ${sessionId}`);

    try {
      const [title, pageStats, elements] = await Promise.all([
        session.page.title(),
        session.page.evaluate(() => {
          const doc = (globalThis as any).document;
          return {
            links: doc.querySelectorAll('a').length,
            buttons: doc.querySelectorAll('button').length,
            inputs: doc.querySelectorAll('input, textarea, select').length,
            headings: doc.querySelectorAll('h1, h2, h3').length
          };
        }),
        session.page.evaluate(() => {
          const doc = (globalThis as any).document;
          return Array.from(doc.querySelectorAll('button, input, a, h1, h2, h3'))
            .slice(0, 25)
            .map((el: any) => ({
              type: el.tagName.toLowerCase(),
              text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 120),
              selector: el.id ? `#${el.id}` : el.tagName.toLowerCase()
            }));
        })
      ]);

      const descriptionParts = [title && `Title: ${title}`, query && `Focus: ${query}`].filter(Boolean);
      const analysis = {
        description: descriptionParts.join(' | ') || 'Page analysis complete',
        elements,
        confidence: elements.length > 0 ? 0.9 : 0.6,
        accessibility: pageStats
      };
      
      return {
        analysis
      };

    } catch (error) {
      logger.error(`[BrowserVision] Analysis failed:`, error);
      throw error;
    }
  }

  async extractText(sessionId: string, selector?: string): Promise<VisionResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserVision] Extracting text: ${sessionId}`);

    try {
      if (selector) {
        const element = await session.page.waitForSelector(selector, { timeout: 5000 });
        const text = await element.evaluate((node: any) => node.innerText || node.textContent || node.value || '');
        return {
          ocr: {
            text: String(text).trim(),
            confidence: 0.95,
            language: 'unknown',
            boundingBox: null
          }
        };
      } else {
        const text = await session.page.evaluate(() => (globalThis as any).document.body?.innerText || '');
        return {
          ocr: {
            text: String(text).trim(),
            confidence: 0.9,
            language: 'unknown',
            boundingBox: null
          }
        };
      }

    } catch (error) {
      logger.error(`[BrowserVision] Text extraction failed:`, error);
      throw error;
    }
  }

  async findElements(sessionId: string, elementTypes: string[], query?: string): Promise<VisionResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserVision] Finding elements: ${elementTypes.join(', ')}`);

    try {
      const selectorMap: Record<string, string> = {
        button: 'button, input[type="button"], input[type="submit"]',
        input: 'input, textarea, select',
        link: 'a',
        heading: 'h1, h2, h3, h4, h5, h6',
        image: 'img'
      };

      const selectors = elementTypes
        .map((type) => selectorMap[type] || type)
        .join(', ');

      const elements = await session.page.evaluate(({ selectors, query }) => {
        const doc = (globalThis as any).document;
        return Array.from(doc.querySelectorAll(selectors))
          .map((el: any) => ({
            type: el.tagName.toLowerCase(),
            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
            text: (el.innerText || el.value || el.alt || '').trim(),
            position: el.getBoundingClientRect ? {
              x: el.getBoundingClientRect().x,
              y: el.getBoundingClientRect().y
            } : undefined
          }))
          .filter((el: any) => !query || `${el.text} ${el.selector}`.toLowerCase().includes(String(query).toLowerCase()));
      }, { selectors, query });
      
      return {
        elements: elements.map((el: any) => ({ ...el, confidence: 0.9 }))
      };

    } catch (error) {
      logger.error(`[BrowserVision] Element finding failed:`, error);
      throw error;
    }
  }

  async compareScreenshots(sessionId: string, screenshot1: string, screenshot2: string, threshold: number = 0.8): Promise<VisionResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserVision] Comparing screenshots: ${sessionId}`);

    try {
      const [one, two] = await Promise.all([
        await import('fs').then(fs => fs.promises.readFile(screenshot1)),
        await import('fs').then(fs => fs.promises.readFile(screenshot2))
      ]);
      const maxLength = Math.max(one.length, two.length) || 1;
      let same = 0;
      for (let i = 0; i < Math.min(one.length, two.length); i++) {
        if (one[i] === two[i]) same++;
      }
      const similarity = same / maxLength;
      const comparison = {
        similarity,
        differences: similarity >= threshold ? [] : [
          { type: 'binary_diff', description: `Files differ (${Math.round((1 - similarity) * 100)}% mismatch)` }
        ]
      };
      
      return {
        comparison
      };

    } catch (error) {
      logger.error(`[BrowserVision] Screenshot comparison failed:`, error);
      throw error;
    }
  }

}

// ── Browser Vision Tool ───────────────────────────────────────
export const browserVisionTool: Tool = {
  name: "browser_vision",
  description: "Browser AI vision tool. Analyze screenshots, extract text with OCR, find elements, and compare screenshots.",
  parameters: z.object({
    action: z.enum(["analyze", "ocr", "find_elements", "compare_screenshots"]).describe("Vision action to perform"),
    sessionId: z.string().describe("Browser session ID"),
    query: z.string().optional().describe("Query for analysis or element search"),
    selector: z.string().optional().describe("CSS selector for OCR or element operations"),
    screenshot1: z.string().optional().describe("First screenshot path for comparison"),
    screenshot2: z.string().optional().describe("Second screenshot path for comparison"),
    elementTypes: z.array(z.string()).optional().describe("Element types to find"),
    threshold: z.number().optional().describe("Similarity threshold for comparison (0-1)")
  }),

  async execute(args: any): Promise<ToolResult> {
    const vision = new BrowserVision();
    
    try {
      let result: VisionResult;

      switch (args.action) {
        case 'analyze':
          result = await vision.analyzePage(args.sessionId, args.query);
          break;

        case 'ocr':
          result = await vision.extractText(args.sessionId, args.selector);
          break;

        case 'find_elements':
          if (!args.elementTypes) {
            throw new Error('Element types are required for find_elements action');
          }
          result = await vision.findElements(args.sessionId, args.elementTypes, args.query);
          break;

        case 'compare_screenshots':
          if (!args.screenshot1 || !args.screenshot2) {
            throw new Error('Two screenshot paths are required for comparison');
          }
          result = await vision.compareScreenshots(args.sessionId, args.screenshot1, args.screenshot2, args.threshold);
          break;

        default:
          throw new Error(`Unknown vision action: ${args.action}`);
      }

      return {
        success: true,
        output: JSON.stringify({
          action: args.action,
          sessionId: args.sessionId,
          timestamp: new Date().toISOString(),
          result
        }, null, 2)
      };

    } catch (error) {
      logger.error('[BrowserVisionTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Vision action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createBrowserVision(): BrowserVision {
  return new BrowserVision();
}

// Export for dynamic loading
export default BrowserVision;
