// ============================================================
// 🦀 Krab — Agent Core (ReAct Loop with Error Recovery)
// ============================================================
import { generateStructured, generateTextResponse } from "../providers/llm.js";
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
    },
  ): Promise<string> {
    const conversationId = options?.conversationId || "default";

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
    await this.summarizeIfNeeded(conversationId);

    try {
      const response = await this.reactLoop(conversationId);

      // Update session for assistant response
      sessionStore.incrementMessageCount(conversationId);

      // Fire hooks: assistant response event
      await hooksManager.fireEvent({
        type: "message:assistant",
        data: { content: response, conversationId },
        timestamp: new Date(),
        sessionId: conversationId
      });

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
        const improvedResponse = await this.reactLoop(conversationId);

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

  private async summarizeIfNeeded(conversationId: string): Promise<void> {
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

        const summary = await generateTextResponse(providerConfig, prompt);

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
  private async reactLoop(conversationId: string): Promise<string> {
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

      // Ensure system prompt is at the top
      const llmMessages = [
        { role: "system" as Role, content: systemPrompt },
        ...messages.filter((m) => m.role !== "system"),
      ];

      try {
        output = await generateStructured(providerConfig, llmMessages);
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

        const results = await executeToolCalls(output.tool_calls);

        // 4. OBSERVE — Feed results back to memory
        for (const { name, result } of results) {
          const observation = result.success
            ? `Tool "${name}" succeeded:\n${result.output}`
            : `Tool "${name}" failed: ${result.error}`;

          this.memory.add({ role: "tool", content: observation, name });

          if (this.config.debug) {
            const icon = result.success ? "✅" : "❌";
            console.log(
              pc.dim(
                `${icon} ${name}: ${result.output?.slice(0, 200) || result.error}`,
              ),
            );
          }
        }

        // 4.5 PROACTIVE REFLECTION — Sanity check after tools
        if (this.config.reflector?.enabled) {
          const intermediateOutput = results
            .map((r) => `${r.name}: ${r.result.success ? "success" : "failed"}`)
            .join(", ");
          const reflection = await this.reflector.reflect(
            "Intermediate Tool Check",
            `Tools executed: ${intermediateOutput}`,
            this.memory.getAll(),
            results.map((r) => ({ name: r.name, args: {}, result: r.result })),
          );

          if (reflection.shouldRetry || reflection.score < 60) {
            logger.warn(
              `[Agent] Intermediate reflection caught an issue: ${reflection.feedback}`,
            );
            this.memory.add({
              role: "assistant",
              content: `[Proactive Reflection] I noticed an issue: ${reflection.feedback}. Suggestions: ${reflection.suggestions.join(". ")}. Adjusting plan...`,
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

  // ── Utility Methods ────────────────────────────────────────
  getMemoryStats() {
    return this.memory.getStats();
  }

  clearMemory() {
    this.memory.clear();
  }

  getConfig() {
    return this.config;
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
    try {
      // Search for semantically similar content in long-term memory
      const similarResults = await this.semanticSearch(userQuery, 3);

      if (similarResults.length === 0) {
        return [];
      }

      // Convert search results to context messages
      const contextMessages: Message[] = [];

      for (const result of similarResults) {
        if (result.score > 0.3) {
          // Only include relevant results
          contextMessages.push({
            role: "system",
            content: `[Context from memory (${Math.round(result.score * 100)}% relevance)]: ${result.entry.content}`,
          });
        }
      }

      if (contextMessages.length > 0) {
        logger.debug(
          `[Agent] Retrieved ${contextMessages.length} context messages from vector memory`,
        );
      }

      return contextMessages;
    } catch (error) {
      logger.warn(`[Agent] Context retrieval failed: ${error}`);
      return [];
    }
  }

  // Enhanced chat method with memory context
  async chatWithMemory(
    userInput: string,
    options: {
      conversationId?: string;
      useMemory?: boolean;
      maxContextItems?: number;
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
      const output = await generateStructured(providerConfig, messages);

      // Handle response
      if (output.next_action === "respond") {
        this.memory.add({ role: "assistant", content: output.response });
        return output.response;
      }

      // Handle tool calls (simplified - would need full react loop)
      if (output.tool_calls.length > 0) {
        const results = await executeToolCalls(output.tool_calls);
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
