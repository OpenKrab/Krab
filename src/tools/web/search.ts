// ============================================================
// 🦀 Krab — Web Search Tool
// ============================================================
import { ToolDefinition as Tool, ToolResult } from "../../core/types.js";
import { logger } from "../../utils/logger.js";
import { z } from "zod";
import { WebFetcher } from "./fetch.js";

export interface WebSearchOptions {
  query: string;
  count?: number;
  engine?: "brave" | "duckduckgo" | "searx";
  language?: string;
  region?: string;
  safeSearch?: "off" | "moderate" | "strict";
  timeRange?: "day" | "week" | "month" | "year";
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface WebSearchResult {
  query: string;
  engine: string;
  results: SearchResult[];
  totalResults?: number;
  searchTime: number;
  timestamp: Date;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  domain: string;
  publishedDate?: string;
  language?: string;
}

export class WebSearcher {
  private webFetcher: WebFetcher;
  private defaultOptions = {
    count: 10,
    engine: "duckduckgo" as const,
    language: "en",
    region: "us",
    safeSearch: "moderate" as const,
    timeRange: "month" as const
  };

  constructor() {
    this.webFetcher = new WebFetcher();
  }

  async search(options: WebSearchOptions): Promise<WebSearchResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    try {
      logger.info(`[WebSearch] Searching: "${opts.query}" using ${opts.engine}`);

      let results: SearchResult[];

      switch (opts.engine) {
        case "brave":
          results = await this.searchBrave(opts);
          break;
        case "duckduckgo":
          results = await this.searchDuckDuckGo(opts);
          break;
        case "searx":
          results = await this.searchSearx(opts);
          break;
        default:
          results = await this.searchDuckDuckGo(opts);
      }

      // Apply domain filters
      if (opts.includeDomains?.length) {
        results = results.filter(r => 
          opts.includeDomains!.some(domain => r.domain.includes(domain))
        );
      }

      if (opts.excludeDomains?.length) {
        results = results.filter(r => 
          !opts.excludeDomains!.some(domain => r.domain.includes(domain))
        );
      }

      // Limit results
      results = results.slice(0, opts.count);

      const result: WebSearchResult = {
        query: opts.query,
        engine: opts.engine,
        results,
        totalResults: results.length,
        searchTime: Date.now() - startTime,
        timestamp: new Date()
      };

      logger.info(`[WebSearch] Completed: ${result.results.length} results in ${result.searchTime}ms`);
      return result;

    } catch (error) {
      logger.error(`[WebSearch] Search failed:`, error);
      throw new Error(`Web search failed: ${(error as Error).message}`);
    }
  }

  private async searchDuckDuckGo(options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      // DuckDuckGo Instant Answer API (HTML version)
      const searchUrl = new URL("https://html.duckduckgo.com/html/");
      searchUrl.searchParams.set("q", options.query);
      searchUrl.searchParams.set("kl", options.language || "en");
      searchUrl.searchParams.set("kj", options.region || "us");
      
      if (options.safeSearch && options.safeSearch !== "moderate") {
        searchUrl.searchParams.set("safe", options.safeSearch);
      }

      const fetchResult = await this.webFetcher.fetch({
        url: searchUrl.toString(),
        extractMode: "html",
        maxChars: 100000
      });

      return this.parseDuckDuckGoResults(fetchResult.content);

    } catch (error) {
      logger.error("[WebSearch] DuckDuckGo search failed:", error);
      throw error;
    }
  }

  private parseDuckDuckGoResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Simple regex-based parsing (in production, use a proper HTML parser)
    const resultRegex = /<a[^>]*class="result__a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>.*?<a[^>]*class="result__snippet[^>]*>([^<]*)<\/a>/gs;
    
    let match;
    let position = 1;
    
    while ((match = resultRegex.exec(html)) !== null && position <= 10) {
      const [, url, title, snippet] = match;
      
      if (url && title && snippet) {
        results.push({
          title: this.cleanText(title),
          url: url.startsWith("http") ? url : `https:${url}`,
          snippet: this.cleanText(snippet),
          position,
          domain: new URL(url.startsWith("http") ? url : `https:${url}`).hostname
        });
        position++;
      }
    }

    return results;
  }

  private async searchBrave(options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      // Note: Brave Search API requires an API key
      // This is a fallback implementation using web search
      logger.warn("[WebSearch] Brave Search API key not configured, using fallback");
      
      // Fallback to DuckDuckGo
      return await this.searchDuckDuckGo({ ...options, engine: "duckduckgo" });

    } catch (error) {
      logger.error("[WebSearch] Brave search failed:", error);
      throw error;
    }
  }

  private async searchSearx(options: WebSearchOptions): Promise<SearchResult[]> {
    try {
      // Searx instance (using a public instance)
      const searchUrl = new URL("https://searx.be/search");
      searchUrl.searchParams.set("q", options.query);
      searchUrl.searchParams.set("format", "json");
      searchUrl.searchParams.set("engines", "google,duckduckgo,bing");
      
      if (options.language) {
        searchUrl.searchParams.set("language", options.language);
      }

      const fetchResult = await this.webFetcher.fetch({
        url: searchUrl.toString(),
        extractMode: "text",
        maxChars: 100000
      });

      const data = JSON.parse(fetchResult.content);
      
      return (data.results || []).map((item: any, index: number) => ({
        title: item.title || "",
        url: item.url || "",
        snippet: item.content || "",
        position: index + 1,
        domain: new URL(item.url).hostname,
        publishedDate: item.publishedDate,
        language: item.language
      }));

    } catch (error) {
      logger.error("[WebSearch] Searx search failed:", error);
      throw error;
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  // Method to get available search engines
  getAvailableEngines(): Array<{ id: string; name: string; description: string; requiresApiKey?: boolean }> {
    return [
      {
        id: "duckduckgo",
        name: "DuckDuckGo",
        description: "Privacy-focused search engine (no API key required)"
      },
      {
        id: "brave",
        name: "Brave Search",
        description: "Privacy-focused search with AI summaries",
        requiresApiKey: true
      },
      {
        id: "searx",
        name: "Searx",
        description: "Meta-search engine aggregating multiple sources"
      }
    ];
  }

  // Method to validate search query
  validateQuery(query: string): { valid: boolean; error?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, error: "Search query cannot be empty" };
    }

    if (query.length > 1000) {
      return { valid: false, error: "Search query too long (max 1000 characters)" };
    }

    return { valid: true };
  }
}

// ── Web Search Tool ────────────────────────────────────────────
export const webSearchTool: Tool = {
  name: "web_search",
  description: "Search the web using multiple search engines. Supports DuckDuckGo, Brave, and Searx with advanced filtering options.",
  parameters: z.object({
    query: z.string().describe("Search query"),
    count: z.number().min(1).max(10).default(10).describe("Number of results to return (1-10)"),
    engine: z.enum(["brave", "duckduckgo", "searx"]).default("duckduckgo").describe("Search engine to use"),
    language: z.string().default("en").describe("Search language code"),
    region: z.string().default("us").describe("Search region code"),
    safeSearch: z.enum(["off", "moderate", "strict"]).default("moderate").describe("Safe search level"),
    timeRange: z.enum(["day", "week", "month", "year"]).default("month").describe("Time filter for results"),
    includeDomains: z.array(z.string()).optional().describe("Include only results from these domains"),
    excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const searcher = new WebSearcher();
      
      // Validate query
      const validation = searcher.validateQuery(args.query);
      if (!validation.valid) {
        return {
          success: false,
          output: "",
          error: validation.error
        };
      }

      const result = await searcher.search(args);

      const response = {
        query: result.query,
        engine: result.engine,
        results: result.results,
        totalResults: result.totalResults,
        searchTime: result.searchTime,
        timestamp: result.timestamp.toISOString()
      };

      logger.info(`[WebSearchTool] Search completed: ${response.results.length} results`);
      return {
        success: true,
        output: JSON.stringify(response, null, 2)
      };

    } catch (error) {
      logger.error("[WebSearchTool] Search failed:", error);
      return {
        success: false,
        output: "",
        error: `Web search failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createWebSearcher(): WebSearcher {
  return new WebSearcher();
}

// Export for dynamic loading
export default WebSearcher;
