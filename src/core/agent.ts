// ============================================================
// 🦀 Krab — Agent Core (ReAct Loop with Error Recovery)
// ============================================================
import { generateStructured } from "../providers/llm.js";
import { executeToolCalls } from "../tools/executor.js";
import { registry } from "../tools/registry.js";
import { ConversationMemory } from "../memory/conversation-enhanced.js";
import {
  Reflector,
  shouldRetryBasedOnQuality,
  formatReflectionSummary,
} from "./reflector.js";
import { logger } from "../utils/logger.js";
import type { KrabConfig, Message } from "./types.js";
import pc from "picocolors";

const SYSTEM_PROMPT = `You are Krab 🦀, a lightweight but powerful AGI assistant.

## Your Capabilities
You can think, plan, use tools, and reflect on your actions.

## Available Tools
{tools}

## Response Rules
1. **Always think step-by-step** before acting.
2. If you need information, use the appropriate tool.
3. If a tool fails, reflect on the error and try a different approach (up to {maxRetries} retries).
4. When you have enough information, respond directly to the user.
5. Keep responses concise but helpful.
6. You can call multiple read-only tools at once for efficiency.
7. For dangerous operations (shell, file write), explain what you're doing first.

## CRITICAL: JSON Output Format
You MUST respond in valid JSON format. Your output will be parsed by a machine.

### Structure:
{
  "thinking": "Your internal reasoning",
  "plan": ["Step 1", "Step 2"],
  "tool_calls": [
    { "name": "tool_name", "args": { "arg1": "value" } }
  ],
  "response": "Final message to user (if next_action is 'respond')",
  "next_action": "respond" | "tool" | "replan"
}
`;

export class Agent {
  private config: KrabConfig;
  private memory: ConversationMemory;
  private reflector: Reflector;
  private iterationCount = 0;

  constructor(config: KrabConfig) {
    this.config = config;
    const workspace = config.agents?.defaults?.workspace || "~/.krab/workspace";
    this.memory = new ConversationMemory(workspace);
    this.reflector = new Reflector(config, config.reflector);
  }
  // ── Main entry point ───────────────────────────────────────
  async chat(
    userInput: string,
    options?: {
      conversationId?: string;
      messages?: Message[];
    },
  ): Promise<string> {
    if (options?.messages) {
      await this.memory.setAll(options.messages);
    }
    this.memory.add({ role: "user", content: userInput });
    this.iterationCount = 0;

    try {
      const response = await this.reactLoop();

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
        const improvedResponse = await this.reactLoop();

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

  // ── ReAct Loop (Think → Act → Observe → Reflect) ──────────
  private async reactLoop(): Promise<string> {
    let retryCount = 0;
    const maxIterations = this.config.maxIterations || 5;
    const maxRetries = this.config.maxRetries || 3;

    while (this.iterationCount < maxIterations) {
      this.iterationCount++;
      logger.debug(`[Agent] Iteration ${this.iterationCount}/${maxIterations}`);

      // Get provider config with fallback
      const providerConfig = this.config.provider || {
        name: "google",
        model: "gemini-2.0-flash",
        apiKey: process.env.GEMINI_API_KEY,
      };

      // 1. THINK — Generate structured output
      let output;
      try {
        output = await generateStructured(providerConfig, this.memory.getAll());
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

        // Check if any tool failed — trigger reflection
        const hasFailure = results.some((r) => !r.result.success);
        if (hasFailure) {
          retryCount++;
          if (retryCount > maxRetries) {
            this.memory.add({
              role: "assistant",
              content:
                "[Recovery exhausted] Could not complete the task after multiple retries.",
            });
            // Let the model generate a final response
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

    // Get recent conversation history
    const recentMessages = this.memory.getRecent(10);

    // Combine context + recent messages
    const allMessages = [...contextMessages, ...recentMessages];

    // Update system prompt with memory context info
    const enhancedSystemPrompt = SYSTEM_PROMPT.replace(
      "{tools}",
      registry
        .getAll()
        .map((t) => `- ${t.name}: ${t.description}`)
        .join("\n"),
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
