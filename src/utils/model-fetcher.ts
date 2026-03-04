// ============================================================
// 🦀 Krab — Dynamic Model Fetcher with Caching
// ============================================================
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const CACHE_DIR = resolve(process.cwd(), ".krab");
const CACHE_FILE = resolve(CACHE_DIR, "models-cache.json");
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
}

interface ModelCache {
  [provider: string]: {
    models: ModelInfo[];
    fetchedAt: number;
  };
}

// Provider endpoints for fetching models
const MODEL_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
  pollinations: "https://text.pollinations.ai/models",
  // Others don't have public model endpoints, use static lists
};

// Static fallback models (when API fails or not available)
const STATIC_MODELS: Record<string, string[]> = {
  google: ["gemini-2.0-flash", "gemini-2.0-pro"],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-opus-latest", "claude-3-haiku-latest"],
  opencode: ["big-pickle", "minimax-m2.5-free", "gpt-5.2-codex", "gpt-5.1-codex", "claude-opus-4.5", "claude-sonnet-4.5", "minimax-m2.1", "gemini-3-pro"],
  kilocode: ["stepfun/step-3.5-flash", "stepfun/step-3.5-flash:free"],
  openrouter: [
    "openrouter/free",
    "stepfun/step-3.5-flash:free",
    "arcee-ai/trinity-large-preview:free",
    "arcee-ai/trinity-mini:free",
    "qwen/qwen3-235b-a22b-thinking-2507:free",
    "qwen/qwen3-coder-480b-a35b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "openai/gpt-oss-120b:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "z-ai/glm-4.5-air:free",
  ],
  deepseek: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
  ollama: ["llama3", "phi4", "qwen2.5", "mistral", "codellama"],
};

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadCache(): ModelCache {
  ensureCacheDir();
  if (!existsSync(CACHE_FILE)) return {};
  try {
    const content = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function saveCache(cache: ModelCache) {
  ensureCacheDir();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function isCacheValid(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

// Fetch models from OpenAI-compatible endpoint
async function fetchOpenAIModels(endpoint: string, apiKey?: string): Promise<ModelInfo[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json() as { data?: Array<{ id: string }> };
  return (data.data || [])
    .filter(m => !m.id.includes("embedding") && !m.id.includes("whisper") && !m.id.includes("tts"))
    .map(m => ({ id: m.id }));
}

// Fetch models from OpenRouter (has rich metadata)
async function fetchOpenRouterModels(): Promise<ModelInfo[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.status}`);
  }

  const data = await response.json() as { data?: Array<any> };
  return (data.data || []).map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    context_length: m.context_length,
    pricing: {
      prompt: m.pricing?.prompt,
      completion: m.pricing?.completion,
    },
  }));
}

// Fetch models from Pollinations
async function fetchPollinationsModels(): Promise<ModelInfo[]> {
  const response = await fetch("https://text.pollinations.ai/models");
  if (!response.ok) {
    throw new Error(`Failed to fetch Pollinations models: ${response.status}`);
  }

  const models = await response.json() as string[];
  return models.map(id => ({ id }));
}

// Main function to get models for a provider
export async function getModels(provider: string, apiKey?: string): Promise<string[]> {
  const cache = loadCache();

  // Check cache first
  if (cache[provider] && isCacheValid(cache[provider].fetchedAt)) {
    console.log(`[ModelCache] Using cached models for ${provider}`);
    return cache[provider].models.map(m => m.id);
  }

  // Try to fetch dynamically
  try {
    let models: ModelInfo[] = [];

    switch (provider) {
      case "openai":
        if (apiKey) {
          models = await fetchOpenAIModels(MODEL_ENDPOINTS.openai, apiKey);
        }
        break;

      case "openrouter":
        models = await fetchOpenRouterModels();
        break;

      case "pollinations":
        models = await fetchPollinationsModels();
        break;

      default:
        // For other providers, use static list
        return STATIC_MODELS[provider] || [];
    }

    // Cache the results
    cache[provider] = {
      models,
      fetchedAt: Date.now(),
    };
    saveCache(cache);

    return models.map(m => m.id);

  } catch (err: any) {
    console.warn(`[ModelFetcher] Failed to fetch models for ${provider}: ${err.message}`);
    // Fallback to static list
    return STATIC_MODELS[provider] || [];
  }
}

// Get detailed model info (for OpenRouter where we have rich data)
export async function getDetailedModels(provider: string): Promise<ModelInfo[]> {
  const cache = loadCache();

  if (provider === "openrouter" && cache.openrouter && isCacheValid(cache.openrouter.fetchedAt)) {
    return cache.openrouter.models;
  }

  if (provider === "openrouter") {
    try {
      const models = await fetchOpenRouterModels();
      cache.openrouter = { models, fetchedAt: Date.now() };
      saveCache(cache);
      return models;
    } catch {
      return [];
    }
  }

  // For other providers, return basic info
  const modelIds = await getModels(provider);
  return modelIds.map(id => ({ id }));
}

// Clear cache (useful when user wants fresh data)
export function clearModelCache() {
  if (existsSync(CACHE_FILE)) {
    writeFileSync(CACHE_FILE, "{}");
  }
}

// Check if we have cached models
export function hasCachedModels(provider: string): boolean {
  const cache = loadCache();
  return !!(cache[provider] && isCacheValid(cache[provider].fetchedAt));
}
