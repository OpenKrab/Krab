// ============================================================
// 🦀 Krab — Built-in Tool: Web Search
// Supports: Tavily (paid) → DuckDuckGo (free fallback)
// ============================================================
import { z } from "zod";
import type { ToolDefinition } from "../../core/types.js";

// ── Tavily Search (Clean JSON results) ─────────────────────
async function searchTavily(
  query: string,
  maxResults: number,
): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!res.ok) throw new Error(`Tavily API error: ${res.status}`);

  const data = (await res.json()) as {
    answer?: string;
    results: Array<{ title: string; url: string; content: string }>;
  };

  const formatted = [
    data.answer ? `**AI Answer:** ${data.answer}\n` : "",
    "**Sources:**",
    ...data.results.map(
      (r, i) =>
        `${i + 1}. [${r.title}](${r.url})\n   ${r.content.slice(0, 200)}`,
    ),
  ].join("\n");

  return formatted;
}

// ── DuckDuckGo Search (Free, no API key) ───────────────────
async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<string> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
  );

  if (!res.ok) throw new Error(`DuckDuckGo API error: ${res.status}`);

  const data = (await res.json()) as {
    Abstract?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
  };

  const results: string[] = [];

  if (data.Abstract) {
    results.push(`**Summary:** ${data.Abstract}`);
    if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}\n`);
  }

  if (data.RelatedTopics && data.RelatedTopics.length > 0) {
    results.push("**Related:**");
    for (const topic of data.RelatedTopics.slice(0, maxResults)) {
      if (topic.Text && topic.FirstURL) {
        results.push(`- ${topic.Text.slice(0, 200)}\n  ${topic.FirstURL}`);
      }
    }
  }

  if (results.length === 0) {
    return `No results found for "${query}". Try a more specific search term.`;
  }

  return results.join("\n");
}

// ── Search Tool Definition ─────────────────────────────────
export const searchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web for information. Uses Tavily API if available (better results), falls back to DuckDuckGo (free). Use this when the user asks about current events, facts, or anything you are unsure about.",
  parameters: z.object({
    query: z.string().describe("The search query"),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args) => {
    const { query, maxResults } = args;

    try {
      // Try Tavily first (better quality)
      if (process.env.TAVILY_API_KEY) {
        const output = await searchTavily(query, maxResults);
        return { success: true, output };
      }

      // Fallback to DuckDuckGo (free)
      const output = await searchDuckDuckGo(query, maxResults);
      return { success: true, output };
    } catch (err: any) {
      // If Tavily fails, try DuckDuckGo
      try {
        const output = await searchDuckDuckGo(query, maxResults);
        return { success: true, output };
      } catch (fallbackErr: any) {
        return {
          success: false,
          output: "",
          error: `Search failed: ${err.message}. Fallback also failed: ${fallbackErr.message}`,
        };
      }
    }
  },
};
