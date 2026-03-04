// ============================================================
// 🦀 Krab — Web Tools Index
// ============================================================
import { WebFetcher, webFetchTool, createWebFetcher } from "./fetch.js";
import { BrowserManager, browserTool, createBrowserManager } from "./browser.js";
import { WebSearcher, webSearchTool, createWebSearcher } from "./search.js";

// Re-export everything
export { WebFetcher, webFetchTool, createWebFetcher };
export { BrowserManager, browserTool, createBrowserManager };
export { WebSearcher, webSearchTool, createWebSearcher };

// Re-export types
export type { WebFetchOptions, WebFetchResult } from "./fetch.js";
export type { BrowserOptions, BrowserResult } from "./browser.js";
export type { WebSearchOptions, WebSearchResult, SearchResult } from "./search.js";

// Web tools collection for easy registration
export const webTools = [
  webFetchTool,
  browserTool,
  webSearchTool
];
