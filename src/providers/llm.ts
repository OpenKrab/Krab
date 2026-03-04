// ============================================================
// 🦀 Krab — Unified LLM Provider (Official SDKs Only)
// ============================================================
import { generateText, streamText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  AgentOutputSchema,
  type ProviderConfig,
  type Message,
  type AgentOutput,
} from "../core/types.js";
import { logger } from "../utils/logger.js";

// ── Provider Factory (Official Only) ────────────────────────
function createModel(config: ProviderConfig) {
  switch (config.name) {
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
      return google(config.model);
    }

    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: config.apiKey });
      return anthropic(config.model);
    }

    case "openai":
    case "kilocode":
    case "opencode":
    case "pollinations":
    case "deepseek":
    case "ollama":
    case "openrouter": {
      const openai = createOpenAI({
        apiKey: config.apiKey || "ollama",
        baseURL: config.baseURL,
      });
      return openai(config.model);
    }

    default:
      throw new Error(`Unsupported provider: ${config.name}`);
  }
}

// ── Convert Krab Messages → AI SDK format ──────────────────
function toModelMessages(messages: Message[]) {
  return messages
    .filter((m) => m.role !== "tool") // Safe filtering for non-legacy tools
    .map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: String(m.content),
    }));
}

// ── Generic OpenAI-compatible API (for kilocode, opencode, ollama) ─────────
async function generateOpenAICompatibleText(
  config: ProviderConfig,
  messages: Message[],
): Promise<string> {
  // Convert messages to OpenAI format
  const openaiMessages = messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role,
      content: String(m.content),
    }));

  const payload: any = {
    model: config.model,
    messages: openaiMessages,
    temperature: 0.1,
  };

  // Some providers need explicit max_tokens
  if (config.name === "kilocode") {
    payload.max_tokens = 4096;
  }

  const url = config.baseURL ? `${config.baseURL}/chat/completions` : "https://api.openai.com/v1/chat/completions";
  logger.debug(`[OpenAI-Compatible] POST to ${url} for ${config.name}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`${config.name} API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as { choices?: [{ message?: { content?: string } }] };
  return data.choices?.[0]?.message?.content || "";
}

// ── Providers that don't support native structured output ────
const PLAIN_TEXT_PROVIDERS = new Set(["ollama", "kilocode", "opencode", "openrouter"]);

// ── Extract JSON from text response ───────────────────────────
function extractJsonFromText(text: string): unknown {
  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue to other attempts
    }
  }
  // Try parsing the whole text
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("No valid JSON found in response");
  }
}

// ── Structured Generation (with fallback) ───────────────────
export async function generateStructured(
  config: ProviderConfig,
  messages: Message[],
): Promise<AgentOutput> {
  // For providers without native structured output support, use text mode + manual parsing
  if (PLAIN_TEXT_PROVIDERS.has(config.name)) {
    logger.debug(`[Provider] ${config.name}/${config.model} → text+parse fallback`);

    // Add JSON instruction to system message
    const jsonInstruction = `

IMPORTANT: You must respond ONLY with a valid JSON object. Do not include markdown formatting, explanations, or any text outside the JSON.

Required JSON structure:
{
  "thinking": "Your internal reasoning about the current situation",
  "plan": ["Step 1", "Step 2"],
  "tool_calls": [{"name": "tool_name", "args": {"arg1": "value"}}],
  "response": "Final response to user (empty if using tools)",
  "next_action": "respond|tool|replan"
}`;

    let modifiedMessages = messages.map((m) =>
      m.role === "system"
        ? { ...m, content: m.content + jsonInstruction }
        : m,
    );

    // Check if we added the instruction, if not, prepend it
    const hasSystem = modifiedMessages.some((m) => m.role === "system");
    if (!hasSystem) {
      modifiedMessages = [{ role: "system", content: jsonInstruction.trim() }, ...modifiedMessages];
    }

    let text: string;

    // Use direct fetch for providers that don't work with AI SDK structured output
    if (config.name === "kilocode" || config.name === "opencode" || config.name === "ollama" || config.name === "openrouter") {
      text = await generateOpenAICompatibleText(config, modifiedMessages);
    } else {
      // Fallback to AI SDK generateText for other providers
      const model = createModel(config);
      const result = await generateText({
        model: model as any,
        messages: toModelMessages(modifiedMessages),
        temperature: 0.1,
      });
      text = result.text;
    }

    const parsed = extractJsonFromText(text);
    const validated = AgentOutputSchema.parse(parsed);
    return validated;
  }

  // Native structured output for supported providers
  const model = createModel(config);

  logger.debug(`[Provider] ${config.name}/${config.model} → structured`);

  const { output } = await generateText({
    model: model as any,
    output: Output.object({ schema: AgentOutputSchema }),
    messages: toModelMessages(messages),
    temperature: 0.1,
  });

  return output as AgentOutput;
}

// ── Streaming & Text Response ──────────────────────────────
export async function generateStream(
  config: ProviderConfig,
  messages: Message[],
): Promise<any> {
  const model = createModel(config);
  logger.debug(`[Provider] Streaming ${config.name}/${config.model}`);
  return streamText({
    model: model as any,
    messages: toModelMessages(messages),
  });
}

export async function generateTextResponse(
  config: ProviderConfig,
  messages: Message[],
): Promise<string> {
  const result = await generateStream(config, messages);
  let text = "";
  for await (const chunk of result.textStream) {
    text += chunk;
  }
  return text;
}
