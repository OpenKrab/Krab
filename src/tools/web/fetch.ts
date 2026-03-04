// ============================================================
// 🦀 Krab — Web Fetch Tool
// ============================================================
import { ToolDefinition as Tool, ToolResult } from "../../core/types.js";
import { logger } from "../../utils/logger.js";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import { z } from "zod";

export interface WebFetchOptions {
  url: string;
  extractMode?: "markdown" | "text" | "html";
  maxChars?: number;
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  followRedirects?: boolean;
}

export interface WebFetchResult {
  url: string;
  title?: string;
  content: string;
  contentType: string;
  statusCode: number;
  contentLength: number;
  duration: number;
  extractedAt: Date;
}

export class WebFetcher {
  private defaultOptions = {
    extractMode: "markdown" as const,
    maxChars: 50000,
    timeout: 30000,
    userAgent: "Krab-Agent/1.0 (Web Fetch Tool)",
    followRedirects: true,
    headers: {}
  };

  async fetch(options: WebFetchOptions): Promise<WebFetchResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    try {
      logger.info(`[WebFetch] Fetching: ${opts.url}`);

      // Validate URL
      const url = new URL(opts.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Unsupported protocol: ${url.protocol}`);
      }

      // Make request
      const response = await this.makeRequest(url, opts);
      
      // Extract content
      const content = await this.extractContent(response.data, opts.extractMode, opts.maxChars);
      
      // Extract title if available
      const title = this.extractTitle(response.data);

      const result: WebFetchResult = {
        url: opts.url,
        title,
        content,
        contentType: response.contentType,
        statusCode: response.statusCode,
        contentLength: response.data.length,
        duration: Date.now() - startTime,
        extractedAt: new Date()
      };

      logger.info(`[WebFetch] Completed: ${result.url} (${result.contentLength} bytes, ${result.duration}ms)`);
      return result;

    } catch (error) {
      logger.error(`[WebFetch] Failed to fetch ${opts.url}:`, error);
      throw new Error(`Web fetch failed: ${(error as Error).message}`);
    }
  }

  private async makeRequest(url: URL, options: WebFetchOptions): Promise<{
    data: string;
    contentType: string;
    statusCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent || this.defaultOptions.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          ...options.headers
        },
        timeout: options.timeout || this.defaultOptions.timeout
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        const contentType = res.headers['content-type'] || 'text/html';
        const statusCode = res.statusCode || 200;

        // Handle redirects
        if (options.followRedirects && statusCode >= 300 && statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url);
          logger.info(`[WebFetch] Following redirect to: ${redirectUrl}`);
          this.makeRequest(redirectUrl, options).then(resolve).catch(reject);
          return;
        }

        // Handle gzip/deflate
        let stream = res;
        if (res.headers['content-encoding'] === 'gzip') {
          const zlib = require('zlib');
          stream = res.pipe(zlib.createGunzip());
        } else if (res.headers['content-encoding'] === 'deflate') {
          const zlib = require('zlib');
          stream = res.pipe(zlib.createInflate());
        }

        stream.on('data', (chunk) => {
          data += chunk;
        });

        stream.on('end', () => {
          if (statusCode >= 400) {
            reject(new Error(`HTTP ${statusCode}: ${res.statusMessage}`));
            return;
          }
          resolve({ data, contentType, statusCode });
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${options.timeout || this.defaultOptions.timeout}ms`));
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  private async extractContent(html: string, mode: "markdown" | "text" | "html", maxChars?: number): Promise<string> {
    switch (mode) {
      case "markdown":
        return this.htmlToMarkdown(html, maxChars);
      case "text":
        return this.htmlToText(html, maxChars);
      case "html":
        return html.length > (maxChars || Infinity) ? html.substring(0, maxChars) + "..." : html;
      default:
        return this.htmlToMarkdown(html, maxChars);
    }
  }

  private htmlToMarkdown(html: string, maxChars?: number): string {
    // Simple HTML to Markdown conversion
    let markdown = html;

    // Remove script and style tags
    markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Convert basic HTML tags to Markdown
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n\n');

    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');

    // Lists
    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
    });

    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      let index = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`) + '\n';
    });

    // Line breaks
    markdown = markdown.replace(/<br[^>]*>/gi, '\n');
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');

    // Clean up whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();

    // Apply max character limit
    if (maxChars && markdown.length > maxChars) {
      markdown = markdown.substring(0, maxChars) + "...";
    }

    return markdown;
  }

  private htmlToText(html: string, maxChars?: number): string {
    // Remove all HTML tags and decode entities
    let text = html;
    
    // Remove script and style tags
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove all HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Decode common HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    // Apply max character limit
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + "...";
    }

    return text;
  }

  private extractTitle(html: string): string | undefined {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      return this.htmlToText(titleMatch[1]);
    }

    // Try h1 as fallback
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
      return this.htmlToText(h1Match[1]);
    }

    return undefined;
  }
}

// ── Web Fetch Tool ────────────────────────────────────────────
export const webFetchTool: Tool = {
  name: "web_fetch",
  description: "Extract content from web pages. Supports markdown, text, or HTML extraction with anti-bot features.",
  parameters: z.object({
    url: z.string().describe("URL to fetch content from"),
    extractMode: z.enum(["markdown", "text", "html"]).default("markdown").describe("Content extraction mode"),
    maxChars: z.number().default(50000).describe("Maximum characters to extract (default: 50000)"),
    timeout: z.number().default(30000).describe("Request timeout in milliseconds (default: 30000)"),
    headers: z.record(z.string(), z.string()).default({}).describe("Additional HTTP headers"),
    userAgent: z.string().default("Krab-Agent/1.0 (Web Fetch Tool)").describe("Custom User-Agent header"),
    followRedirects: z.boolean().default(true).describe("Follow HTTP redirects")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const fetcher = new WebFetcher();
      const result = await fetcher.fetch(args);

      const response = {
        url: result.url,
        title: result.title,
        content: result.content,
        contentType: result.contentType,
        statusCode: result.statusCode,
        contentLength: result.contentLength,
        duration: result.duration,
        extractedAt: result.extractedAt.toISOString()
      };

      logger.info(`[WebFetchTool] Successfully fetched: ${result.url}`);
      return {
        success: true,
        output: JSON.stringify(response, null, 2)
      };

    } catch (error) {
      logger.error("[WebFetchTool] Fetch failed:", error);
      return {
        success: false,
        output: "",
        error: `Web fetch failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createWebFetcher(): WebFetcher {
  return new WebFetcher();
}

// Export for dynamic loading
export default WebFetcher;
