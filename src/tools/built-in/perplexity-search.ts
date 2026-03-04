// ============================================================
// 🦀 Krab — Perplexity-Style Web Search
// AI-powered search with real-time results, citations, and summaries
// ============================================================
import { z } from "zod";
import type { ToolDefinition } from "../../core/types.js";
import { logger } from "../../utils/logger.js";

interface SearchResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
  publishedDate?: string;
}

interface PerplexitySearchResult {
  query: string;
  answer: string;
  sources: SearchResult[];
  relatedQuestions?: string[];
}

// ── Search with multiple providers ───────────────────────────
async function searchMultipleProviders(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  // Try multiple search APIs in parallel
  const searchPromises = [
    searchDuckDuckGo(query),
    searchBing(query),
    searchBrave(query)
  ];
  
  const searchResults = await Promise.allSettled(searchPromises);
  
  for (const result of searchResults) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      results.push(...result.value);
    }
  }
  
  // Remove duplicates based on URL
  const uniqueResults = results.filter((result, index, self) => 
    index === self.findIndex(r => r.url === result.url)
  );
  
  return uniqueResults.slice(0, 10);
}

// ── DuckDuckGo Search ──────────────────────────────────────
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'Krab/1.0' } }
    );

    if (!res.ok) throw new Error(`DuckDuckGo API error: ${res.status}`);

    const data = await res.json() as any;
    const results: SearchResult[] = [];

    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Overview',
        url: data.AbstractURL || '',
        content: data.Abstract,
        snippet: data.Abstract.slice(0, 300)
      });
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Related Topic',
            url: topic.FirstURL,
            content: topic.Text,
            snippet: topic.Text.slice(0, 300)
          });
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('[Search] DuckDuckGo failed:', error);
    return [];
  }
}

// ── Bing Search (if API key available) ──────────────────────
async function searchBing(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10`,
      { headers: { 'Ocp-Apim-Subscription-Key': apiKey } }
    );

    if (!res.ok) throw new Error(`Bing API error: ${res.status}`);

    const data = await res.json() as any;
    
    return (data.webPages?.value || []).map((item: any) => ({
      title: item.name,
      url: item.url,
      content: item.snippet,
      snippet: item.snippet,
      publishedDate: item.datePublished
    }));
  } catch (error) {
    logger.error('[Search] Bing failed:', error);
    return [];
  }
}

// ── Brave Search (if API key available) ─────────────────────
async function searchBrave(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      { 
        headers: { 
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json'
        } 
      }
    );

    if (!res.ok) throw new Error(`Brave API error: ${res.status}`);

    const data = await res.json() as any;
    
    return (data.web?.results || []).map((item: any) => ({
      title: item.title,
      url: item.url,
      content: item.description,
      snippet: item.description,
      publishedDate: item.age
    }));
  } catch (error) {
    logger.error('[Search] Brave failed:', error);
    return [];
  }
}

// ── Generate AI Answer with Citations ───────────────────────
async function generateAIAnswer(
  query: string, 
  sources: SearchResult[]
): Promise<string> {
  // If no OpenRouter key, return formatted sources
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || sources.length === 0) {
    return formatSimpleAnswer(query, sources);
  }

  try {
    // Prepare context from sources
    const context = sources
      .slice(0, 5)
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.content}`)
      .join('\n\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://krab.dev',
        'X-OpenRouter-Title': 'Krab'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an AI search assistant like Perplexity. Provide comprehensive, accurate answers based on the search results provided. Always cite your sources using [1], [2], etc. Be concise but thorough. If the search results don't contain enough information, say so. Current date: ${new Date().toISOString().split('T')[0]}`
          },
          {
            role: 'user',
            content: `Query: ${query}\n\nSearch Results:\n${context}\n\nPlease provide a comprehensive answer with citations.`
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || formatSimpleAnswer(query, sources);

  } catch (error) {
    logger.error('[Search] AI answer generation failed:', error);
    return formatSimpleAnswer(query, sources);
  }
}

// ── Format Simple Answer (fallback) ─────────────────────────
function formatSimpleAnswer(query: string, sources: SearchResult[]): string {
  if (sources.length === 0) {
    return `I couldn't find any results for "${query}". Please try a different search term.`;
  }

  const answer = sources[0]?.content || '';
  const formattedSources = sources.slice(0, 5).map((s, i) => 
    `[${i + 1}] [${s.title}](${s.url})`
  ).join('\n');

  return `**Answer:**\n${answer}\n\n**Sources:**\n${formattedSources}`;
}

// ── Generate Related Questions ───────────────────────────────
function generateRelatedQuestions(query: string, sources: SearchResult[]): string[] {
  const related = [
    `${query} latest news`,
    `${query} tutorial`,
    `${query} vs alternative`,
    `how to ${query}`,
    `${query} 2024`
  ];
  
  return related.slice(0, 4);
}

// ── Enhanced Search Tool (Perplexity-style) ─────────────────
export const searchTool: ToolDefinition = {
  name: "web_search",
  description: "Search the web with AI-powered results like Perplexity. Provides comprehensive answers with real-time information, citations, and source links. Use for current events, research, fact-checking, and exploring topics.",
  parameters: z.object({
    query: z.string().describe("The search query - be specific for better results"),
    maxResults: z.number().optional().default(8).describe("Maximum number of sources to include"),
    includeAnswer: z.boolean().optional().default(true).describe("Generate AI-powered answer with citations"),
    includeRelated: z.boolean().optional().default(true).describe("Include related questions")
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args) => {
    const { query, maxResults, includeAnswer, includeRelated } = args;

    logger.info(`[Search] Perplexity-style search: ${query}`);

    try {
      // Step 1: Search multiple sources
      const sources = await searchMultipleProviders(query);
      
      if (sources.length === 0) {
        return {
          success: true,
          output: `🔍 **Search Results for "${query}"**\n\nNo results found. Try:\n- Using different keywords\n- Being more specific\n- Checking your spelling`
        };
      }

      // Step 2: Generate AI answer with citations
      let answer = '';
      if (includeAnswer) {
        answer = await generateAIAnswer(query, sources);
      }

      // Step 3: Format sources with citations
      const limitedSources = sources.slice(0, maxResults);
      const sourcesFormatted = limitedSources.map((s, i) => 
        `${i + 1}. **[${s.title}](${s.url})**\n   ${s.snippet || s.content.slice(0, 200)}${s.content.length > 200 ? '...' : ''}`
      ).join('\n\n');

      // Step 4: Generate related questions
      let relatedFormatted = '';
      if (includeRelated) {
        const related = generateRelatedQuestions(query, sources);
        relatedFormatted = '\n\n**Related Questions:**\n' + related.map(q => `• ${q}`).join('\n');
      }

      // Step 5: Compile final output
      const timestamp = new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const output = [
        `🔍 **${query}**`,
        `*Searched ${timestamp}*`,
        '',
        answer,
        '',
        '---',
        `**Sources (${limitedSources.length}):**`,
        sourcesFormatted,
        relatedFormatted
      ].join('\n');

      return {
        success: true,
        output
      };

    } catch (err: any) {
      logger.error('[Search] Failed:', err);
      return {
        success: false,
        output: "",
        error: `Search failed: ${err.message}`
      };
    }
  }
};

// ── Quick Answer Tool ───────────────────────────────────────
export const quickAnswerTool: ToolDefinition = {
  name: "quick_answer",
  description: "Get a quick, concise answer to a question using web search. Best for simple factual queries.",
  parameters: z.object({
    question: z.string().describe("The question to answer")
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args) => {
    const { question } = args;
    
    // Use the main search tool with minimal results
    const result = await searchTool.execute({ 
      query: question, 
      maxResults: 3,
      includeRelated: false 
    });
    
    return result;
  }
};

// ── Research Tool ───────────────────────────────────────────
export const researchTool: ToolDefinition = {
  name: "deep_research",
  description: "Conduct deep research on a topic. Searches multiple sources and provides comprehensive analysis with multiple perspectives.",
  parameters: z.object({
    topic: z.string().describe("The research topic"),
    aspects: z.array(z.string()).optional().describe("Specific aspects to research (e.g., ['history', 'current status', 'future trends'])"),
    maxSources: z.number().optional().default(15).describe("Maximum number of sources")
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args) => {
    const { topic, aspects, maxSources } = args;
    
    logger.info(`[Search] Deep research: ${topic}`);
    
    try {
      // Search for main topic
      const mainResults = await searchMultipleProviders(topic);
      
      // Search for specific aspects
      let aspectResults: SearchResult[] = [];
      if (aspects && aspects.length > 0) {
        for (const aspect of aspects) {
          const results = await searchMultipleProviders(`${topic} ${aspect}`);
          aspectResults.push(...results);
        }
      }
      
      // Combine and deduplicate
      const allSources = [...mainResults, ...aspectResults];
      const uniqueSources = allSources.filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
      ).slice(0, maxSources);
      
      // Generate comprehensive research report
      const apiKey = process.env.OPENROUTER_API_KEY;
      let analysis = '';
      
      if (apiKey && uniqueSources.length > 0) {
        const context = uniqueSources
          .map((s, i) => `[${i + 1}] ${s.title}\n${s.content}`)
          .join('\n\n');
          
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://krab.dev',
            'X-OpenRouter-Title': 'Krab'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a research analyst. Provide a comprehensive research report with multiple perspectives, key findings, and citations. Structure with: Executive Summary, Key Findings, Different Perspectives, and Conclusion.'
              },
              {
                role: 'user',
                content: `Research Topic: ${topic}\n${aspects ? `Aspects: ${aspects.join(', ')}` : ''}\n\nSources:\n${context}\n\nProvide a comprehensive research report.`
              }
            ],
            temperature: 0.3
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          analysis = data.choices?.[0]?.message?.content || '';
        }
      }
      
      const output = [
        `📚 **Research Report: ${topic}**`,
        '',
        analysis || 'Research sources collected. Analysis unavailable.',
        '',
        '---',
        `**Sources (${uniqueSources.length}):**`,
        ...uniqueSources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
      ].join('\n');
      
      return { success: true, output };
      
    } catch (err: any) {
      logger.error('[Search] Research failed:', err);
      return {
        success: false,
        output: "",
        error: `Research failed: ${err.message}`
      };
    }
  }
};

export const perplexityStyleTools = [searchTool, quickAnswerTool, researchTool];
