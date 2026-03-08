// ============================================================
// 🦀 Krab — Agent Core (ReAct Loop with Error Recovery)
// ============================================================
import { generateStructured, generateTextResponse } from "../providers/llm.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeToolCalls } from "../tools/executor.js";
import { registry } from "../tools/registry.js";
import { ConversationMemory } from "../memory/conversation-enhanced.js";
import { sessionStore } from "../session/store.js";
import { SessionPruner } from "../session/pruning.js";
import { memoryManager } from "../memory/manager.js";
import {
  Reflector,
  shouldRetryBasedOnQuality,
  formatReflectionSummary,
} from "./reflector.js";
import { logger } from "../utils/logger.js";
import type { KrabConfig, Message, Role } from "./types.js";
import pc from "picocolors";
import { hooksManager } from "../hooks/index.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PROMPTS_PATH = resolve(__dirname, "prompts.json");

function loadPrompts() {
  try {
    return JSON.parse(readFileSync(PROMPTS_PATH, "utf-8"));
  } catch (error) {
    logger.error(`Failed to load prompts from ${PROMPTS_PATH}`);
    return { agent: { system: "" }, summarizer: { system: "" } };
  }
}

const prompts = loadPrompts();
const SYSTEM_PROMPT = prompts.agent.system;

// Global trace store for recent turns
const recentTraces: any[] = [];
const MAX_TRACES = 10;

function addTrace(trace: any) {
  recentTraces.unshift(trace);
  if (recentTraces.length > MAX_TRACES) {
    recentTraces.pop();
  }
}

export function getRecentTraces() {
  return [...recentTraces];
}

export class Agent {
  private config: KrabConfig;
  private memory: ConversationMemory;
  private reflector: Reflector;
  private pruner: SessionPruner;
  private cachedMemory: string | null = null;
  private iterationCount = 0;

  constructor(config: KrabConfig) {
    this.config = config;
    const workspace = config.agents?.defaults?.workspace || "~/.krab/workspace";
    this.memory = new ConversationMemory(workspace);
    this.reflector = new Reflector(config, config.reflector);
    this.pruner = new SessionPruner({
      enabled: config.agents?.defaults?.sessionPruning?.enabled ?? false,
      mode: config.agents?.defaults?.sessionPruning?.mode ?? "cache-ttl",
      ttl: config.agents?.defaults?.sessionPruning?.ttl ?? "5m",
      keepLastAssistants: config.agents?.defaults?.sessionPruning?.keepLastAssistants ?? 3,
      contextWindowEstimation: config.agents?.defaults?.sessionPruning?.contextWindowEstimation ?? 200000
    });
  }
  // ── Main entry point ───────────────────────────────────────
  async chat(
    userInput: string,
    options?: {
      conversationId?: string;
      messages?: Message[];
      signal?: AbortSignal;
      onProgress?: (event: {
        type: 'thinking' | 'tool_call' | 'tool_result';
        content?: string;
        name?: string;
        args?: any;
        result?: any;
        timestamp?: number;
      }) => void;
    },
  ): Promise<string> {
    const conversationId = options?.conversationId || "default";
    const trace = {
      turnId: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userInput,
      conversationId,
      memoryRetrieved: [] as any[],
      toolsCalled: [] as any[],
      responseGenerated: "",
      startedAt: Date.now(),
      completedAt: 0,
      duration: 0,
      error: null as string | null,
    };

    // Update session metadata
    sessionStore.incrementMessageCount(conversationId);

    // Fire hooks: user message event
    await hooksManager.fireEvent({
      type: "message:user",
      data: { content: userInput, conversationId },
      timestamp: new Date(),
      sessionId: conversationId
    });

    this.memory.addMessage(conversationId, {
      role: "user",
      content: userInput,
    });
    this.iterationCount = 0;

    // Trigger proactive summarization if needed
    await this.summarizeIfNeeded(conversationId, options?.signal);

    try {
      const response = await this.reactLoop(conversationId, options?.signal, userInput, (event) => {
        // Store trace events
        if (event.type === 'thinking') {
          // Could store thinking if needed
        } else if (event.type === 'tool_call') {
          trace.toolsCalled.push({
            name: event.name,
            args: event.args,
            timestamp: event.timestamp
          });
        } else if (event.type === 'tool_result') {
          // Results are already tracked
        }

        // Call onProgress if provided
        options?.onProgress?.(event);
      });

      // Update session for assistant response
      sessionStore.incrementMessageCount(conversationId);

      // Fire hooks: assistant response event
      await hooksManager.fireEvent({
        type: "message:assistant",
        data: { content: response, conversationId },
        timestamp: new Date(),
        sessionId: conversationId
      });

      // Post-turn memory writeback
      // TODO: Implement response fact extraction and long-term memory writeback
      const facts = this.extractFactsFromResponse(response);
      if (facts.length > 0) {
        memoryManager.writeToLongTermMemory(facts.join('\n'));
        logger.debug(`[Agent] Wrote ${facts.length} facts to long-term memory`);
      }

      // Complete trace
      trace.responseGenerated = response;
      trace.completedAt = Date.now();
      trace.duration = trace.completedAt - trace.startedAt;

      // Store trace
      addTrace(trace);

      // Reflection step
      if (this.config.reflector?.enabled) {
        const reflection = await this.reflector.reflect(
          userInput,
          response,
          this.memory.getAll(),
        );

        if (this.config.debug) {
          console.log(
            pc.dim(`🔍 Reflection: ${formatReflectionSummary(reflection)}`),
          );
          if (reflection.suggestions.length > 0) {
            console.log(
              pc.dim(`💡 Suggestions: ${reflection.suggestions.join(", ")}`),
            );
          }
        }

        // Check if response quality is acceptable
        if (
          !shouldRetryBasedOnQuality(
            reflection,
            this.config.reflector.threshold,
          )
        ) {
          return response;
        }

        // Response needs improvement, add feedback and retry
        logger.info(
          `[Agent] Response quality too low (${reflection.score}), retrying with feedback`,
        );

        // Add reflection feedback to memory
        this.memory.add({
          role: "assistant",
          content: `[Reflection] Previous response needs improvement. Quality: ${reflection.quality} (${reflection.score}/100). ${reflection.feedback}. ${reflection.suggestions.join(" ")}. Let me try again...`,
        });

        // Reset iteration count and retry
        this.iterationCount = 0;
        const improvedResponse = await this.reactLoop(conversationId, options?.signal, userInput, options?.onProgress);

        // Reflect on the improved response too
        const secondReflection = await this.reflector.reflect(
          userInput,
          improvedResponse,
          this.memory.getAll(),
        );

        if (this.config.debug) {
          console.log(
            pc.dim(
              `🔍 Improved response: ${formatReflectionSummary(secondReflection)}`,
            ),
          );
        }

        return improvedResponse;
      }

      return response;
    } catch (err: any) {
      logger.error(`[Agent] Fatal error: ${err.message}`);
      return `❌ Error: ${err.message}`;
    }
  }

  // ── Context Retrieval ───────────────────────────────────────
  private getEnhancedSystemPrompt(conversationId: string): string {
    const summary = this.memory.getSummary(conversationId) || "No previous summary.";
    const toolsText = registry
      .getAll()
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");

    // Load memory content for main sessions
    let memoryContent = "";
    if (conversationId === "main" || conversationId.startsWith("dm-main")) {
      if (this.cachedMemory === null) {
        // Load memory once and cache
        const dailyMemory = memoryManager.readDailyMemory();
        const longTermMemory = memoryManager.readLongTermMemory();
        this.cachedMemory = [dailyMemory, longTermMemory].filter(Boolean).join("\n\n");
      }
      memoryContent = this.cachedMemory;
    }

    return SYSTEM_PROMPT.replace("{tools}", toolsText)
      .replace("{memorySummary}", summary)
      .replace("{memory}", memoryContent || "No memory content available.");
  }

  private async summarizeIfNeeded(conversationId: string, signal?: AbortSignal): Promise<void> {
    const stats = this.memory.getConversationStats(conversationId);
    if (!stats) return;

    const limit = this.config.memoryLimit || 50;

    if (stats.messageCount >= limit) {
      logger.info(
        `[Agent] Memory limit reached for ${conversationId} (${stats.messageCount}/${limit}). Triggering proactive summarization...`,
      );

      const conv = this.memory.getConversation(conversationId);
      if (!conv) return;

      const historyText = conv.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const prompt: Message[] = [
        {
          role: "system",
          content: prompts.summarizer.system,
        },
        { role: "user", content: `History to summarize:\n${historyText}` },
      ];

      try {
        const providerConfig = this.config.provider || {
          name: "google",
          model: "gemini-2.0-flash",
          apiKey: process.env.GEMINI_API_KEY,
        };

        const summary = await generateTextResponse(providerConfig, prompt, signal);

        this.memory.setSummary(conversationId, summary);

        // Prune history: keep system prompt if any, and last 10 messages
        const messages = conv.messages;
        const systemMessages = messages.filter((m) => m.role === "system");
        const recent = messages.slice(-10);

        this.memory.setMessages(conversationId, [...systemMessages, ...recent]);

        logger.info(
          `[Agent] Memory summarized and pruned for ${conversationId}.`,
        );
      } catch (err: any) {
        logger.warn(`[Agent] Summarization failed: ${err.message}`);
      }
    }
  }

  // ── ReAct Loop (Think → Act → Observe → Reflect) ──────────
  private async reactLoop(
    conversationId: string,
    signal?: AbortSignal,
    userInput?: string,
    onProgress?: (event: {
      type: 'thinking' | 'tool_call' | 'tool_result';
      content?: string;
      name?: string;
      args?: any;
      result?: any;
      timestamp?: number;
    }) => void
  ): Promise<string> {
    let retryCount = 0;
    const maxIterations = this.config.maxIterations || 5;
    const maxRetries = this.config.maxRetries || 3;

    while (this.iterationCount < maxIterations) {
      this.iterationCount++;
      logger.debug(`[Agent] Iteration ${this.iterationCount}/${maxIterations}`);

      const providerConfig = this.config.provider || {
        name: "google",
        model: "gemini-2.0-flash",
        apiKey: process.env.GEMINI_API_KEY,
      };

      // 1. THINK — Generate structured output
      let output;
      const systemPrompt = this.getEnhancedSystemPrompt(conversationId);
      let messages = this.memory.getRecentMessages(conversationId, 20);

      // Apply session pruning if enabled
      const pruningResult = this.pruner.pruneMessages(conversationId, messages);
      if (pruningResult.prunedCount > 0) {
        logger.debug(`[Agent] Pruned ${pruningResult.prunedCount} tool results from session ${conversationId}`);
        messages = pruningResult.messages;
      }

      // Retrieve relevant context from memory for this turn
      const contextMessages = userInput ? await this.retrieveRelevantContext(userInput) : [];
      const limitedContextMessages = contextMessages.slice(0, 3); // Limit to 3 most relevant

      // Ensure system prompt is at the top
      const llmMessages = [
        { role: "system" as Role, content: systemPrompt },
        ...limitedContextMessages,
        ...messages.filter((m) => m.role !== "system"),
      ];

      try {
        output = await generateStructured(providerConfig, llmMessages, signal);
      } catch (err: any) {
        // Error recovery: retry with reflection
        retryCount++;
        if (retryCount > maxRetries) {
          return `❌ Failed after ${maxRetries} retries: ${err.message}`;
        }
        logger.warn(
          `[Agent] LLM error (retry ${retryCount}/${maxRetries}): ${err.message}`,
        );
        this.memory.add({
          role: "assistant",
          content: `[Error Recovery] LLM call failed: ${err.message}. Retrying with simpler approach...`,
        });
        continue;
      }

      // Debug: Show thinking
      if (this.config.debug) {
        console.log(pc.dim(`💭 Thinking: ${output.thinking}`));
        if (output.plan.length > 0) {
          console.log(pc.dim(`📋 Plan: ${output.plan.join(" → ")}`));
        }
      }

      // Report thinking progress
      onProgress?.({
        type: 'thinking',
        content: output.thinking,
        timestamp: Date.now()
      });

      // 2. DECIDE — respond directly or use tools
      if (output.next_action === "respond" || output.tool_calls.length === 0) {
        // Final response
        this.memory.add({ role: "assistant", content: output.response });
        return output.response;
      }

      // 3. ACT — Execute tool calls
      if (output.next_action === "tool") {
        console.log(
          pc.cyan(
            `🔧 Using tools: ${output.tool_calls.map((t) => t.name).join(", ")}`,
          ),
        );

        // Report tool calls progress
        for (const toolCall of output.tool_calls) {
          onProgress?.({
            type: 'tool_call',
            name: toolCall.name,
            args: toolCall.args,
            timestamp: Date.now()
          });
        }

        const results = await executeToolCalls(output.tool_calls, { agentId: conversationId, signal });

        // 4. OBSERVE — Feed results back to memory and yield results
        for (const { name, result } of results) {
          const observation = result.success
            ? `Tool "${name}" succeeded:\n${result.output}`
            : `Tool "${name}" failed: ${result.error}`;

          this.memory.add({ role: "tool", content: observation, name });

          // Report tool result progress
          onProgress?.({
            type: 'tool_result',
            name,
            result,
            timestamp: Date.now()
          });

          if (this.config.debug) {
            const icon = result.success ? "✅" : "❌";
            console.log(
              pc.dim(
                `${icon} ${name}: ${result.output?.slice(0, 200) || result.error}`,
              ),
            );
          }
        }

        // Intermediate streaming reflection on tool usage
        if (this.config.reflector?.enabled && output.tool_calls.length > 0) {
          const toolUsageSummary = `Executed ${output.tool_calls.length} tools: ${output.tool_calls.map(tc => tc.name).join(', ')}. Results: ${results.map(r => `${r.name}:${r.result.success ? 'success' : 'failed'}`).join(', ')}`;

          const intermediateReflection = await this.reflector.reflect(
            "Tool Usage Quality Assessment",
            toolUsageSummary,
            this.memory.getAll(),
            results.map((r) => ({ name: r.name, args: {}, result: r.result })),
          );

          if (intermediateReflection.shouldRetry || intermediateReflection.score < 70) {
            logger.info(
              `[Agent] Intermediate reflection: tool usage quality ${intermediateReflection.score}/100, ${intermediateReflection.feedback}`,
            );

            // Report reflection via onProgress if available
            onProgress?.({
              type: 'thinking',
              content: `🔄 Reflecting on tool usage: ${intermediateReflection.feedback}`,
              timestamp: Date.now()
            });

            this.memory.add({
              role: "assistant",
              content: `[Tool Quality Reflection] Score: ${intermediateReflection.score}/100. ${intermediateReflection.feedback}. Suggestions: ${intermediateReflection.suggestions.join('. ')}. Adjusting approach...`,
            });
            retryCount++;
            continue;
          }
        }

        // Check if any tool failed (standard logic)
        const hasFailure = results.some((r) => !r.result.success);
        if (hasFailure) {
          retryCount++;
          if (retryCount > maxRetries) {
            this.memory.add({
              role: "assistant",
              content:
                "[Recovery exhausted] Could not complete the task after multiple retries.",
            });
          } else {
            this.memory.add({
              role: "assistant",
              content: `[Reflection] Some tools failed. Attempt ${retryCount}/${maxRetries}. Let me try a different approach...`,
            });
          }
        }

        // Continue the loop for more thinking
        continue;
      }

      // 5. REPLAN — Agent wants to try again
      if (output.next_action === "replan") {
        logger.debug("[Agent] Replanning...");
        this.memory.add({
          role: "assistant",
          content: `[Replan] Previous approach didn't work. New plan: ${output.plan.join(", ")}`,
        });
        continue;
      }
    }

    // Max iterations reached
    return "⚠️ Reached maximum iterations. Please try a simpler request.";
  }

  private extractFactsFromResponse(response: string): string[] {
    // More sophisticated fact extraction
    // Split into sentences and identify factual statements
    const sentences = response.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

    const facts: string[] = [];

    // Enhanced fact indicators with patterns
    const factPatterns = [
      // Declarative statements
      /\b(is|are|was|were|has|have|had|will|can|cannot|should|must|does|did|makes|made|creates|created)\b/i,
      // Technical terms (may indicate factual content)
      /\b(API|function|method|class|library|framework|protocol|standard)\b/i,
      // Measurements and quantities
      /\b(\d+(?:\.\d+)?\s*(?:%|bytes|MB|GB|seconds|minutes|hours|days))\b/i,
      // Proper nouns (names, places, organizations)
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/,
      // Version numbers
      /\bv?\d+(?:\.\d+)+(?:\.\d+)*\b/,
    ];

    const nonFactIndicators = [
      /\b(I|you|we|they|it)\s+(think|believe|feel|want|need|hope|wish)/i,
      /\b(perhaps|maybe|possibly|might|could|would)\b/i,
      /\b(let me|I will|I'll|you can|try to)\b/i,
      /\b(question|ask|help|support|please|thank|sorry)\b/i,
    ];

    for (const sentence of sentences) {
      // Skip if contains non-fact indicators
      if (nonFactIndicators.some(pattern => pattern.test(sentence))) {
        continue;
      }

      // Check if contains fact patterns
      const hasFactPattern = factPatterns.some(pattern => pattern.test(sentence));

      // Additional criteria: reasonable length, not starting with lowercase
      const isReasonableLength = sentence.length > 15 && sentence.length < 250;
      const startsWithCapital = /^[A-Z]/.test(sentence);

      if (hasFactPattern && isReasonableLength && startsWithCapital) {
        facts.push(sentence);
      }
    }

    // Deduplicate and limit
    const uniqueFacts = [...new Set(facts)].slice(0, 5);

    return uniqueFacts;
  }

  // ── Vector Memory Methods ───────────────────────────────────
  async semanticSearch(query: string, limit: number = 5): Promise<any[]> {
    return await this.memory.semanticSearch(query, limit);
  }

  async findSimilar(content: string, limit: number = 3): Promise<any[]> {
    return await this.memory.findSimilar(content, limit);
  }

  async searchConversation(
    conversationId: string,
    query: string,
    limit: number = 5,
  ): Promise<any[]> {
    return await this.memory.searchConversation(conversationId, query, limit);
  }

  getVectorMemory() {
    return this.memory.getVectorMemory();
  }

  // ── Context Retrieval ───────────────────────────────────────
  private async retrieveRelevantContext(userQuery: string): Promise<Message[]> {
    const results = await this.memory.semanticSearch(userQuery, 10); // Increased limit for better selection
    return results.slice(0, 3).flatMap(hit => hit.conversation.messages);
  }

  // Enhanced chat method with memory context
  async chatWithMemory(
    userInput: string,
    options: {
      conversationId?: string;
      useMemory?: boolean;
      maxContextItems?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<string> {
    const { conversationId, useMemory = true, maxContextItems = 3 } = options;

    // Add user message to memory
    this.memory.add({ role: "user", content: userInput });

    // Retrieve relevant context from long-term memory if enabled
    let contextMessages: Message[] = [];
    if (useMemory) {
      contextMessages = await this.retrieveRelevantContext(userInput);
      // Limit context to avoid token overflow
      contextMessages = contextMessages.slice(0, maxContextItems);
    }

    // Combine context + recent messages
    const recentMessages = this.memory.getRecentMessages(
      conversationId || "default",
      10,
    );
    const allMessages = [...contextMessages, ...recentMessages];

    // Update system prompt with memory context info
    const enhancedSystemPrompt = this.getEnhancedSystemPrompt(
      conversationId || "default",
    );

    // Replace system message with enhanced version
    const messages = allMessages.map((msg) =>
      msg.role === "system" ? { ...msg, content: enhancedSystemPrompt } : msg,
    );

    // Ensure we have a system message
    if (!messages.some((m) => m.role === "system")) {
      messages.unshift({ role: "system", content: enhancedSystemPrompt });
    }

    // Reset iteration count for new conversation turn
    this.iterationCount = 0;

    // Get provider config with fallback
    const providerConfig = this.config.provider || {
      name: "google",
      model: "gemini-2.0-flash",
      apiKey: process.env.GEMINI_API_KEY,
    };

    try {
      // Generate structured output with context
      const output = await generateStructured(providerConfig, messages, options?.signal);

      // Handle response
      if (output.next_action === "respond") {
        this.memory.add({ role: "assistant", content: output.response });
        return output.response;
      }

      // Handle tool calls (simplified - would need full react loop)
      if (output.tool_calls.length > 0) {
        const results = await executeToolCalls(output.tool_calls, { agentId: conversationId || "default" });
        const response = results
          .map((r) =>
            r.result.success
              ? `✅ ${r.name}: ${r.result.output}`
              : `❌ ${r.name}: ${r.result.error}`,
          )
          .join("\n");

        this.memory.add({ role: "assistant", content: response });
        return response;
      }

      return "I need more information to help you with that.";
    } catch (error) {
      logger.error(`[Agent] Chat with memory failed: ${error}`);
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
