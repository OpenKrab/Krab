// ============================================================
// 🦀 Krab — Reflector (Agent Self-Review System)
// ============================================================
import { generateStructured } from "../providers/llm.js";
import { logger } from "../utils/logger.js";
import type { Message, KrabConfig } from "./types.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

export interface ReflectionResult {
  quality: "excellent" | "good" | "needs_improvement" | "poor";
  score: number; // 0-100
  feedback: string;
  suggestions: string[];
  shouldRetry: boolean;
  improvedResponse?: string;
}

export interface ReflectionOptions {
  enabled: boolean;
  threshold: number; // Minimum score to accept response
  maxRetries: number;
  useSeparateModel: boolean; // Use different model for reflection
  reflectionPrompt?: string;
}

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PROMPTS_PATH = resolve(__dirname, "prompts.json");

function loadReflectorPrompt(): string {
  try {
    const data = JSON.parse(readFileSync(PROMPTS_PATH, "utf-8"));
    return data.reflector.system;
  } catch (error) {
    logger.error(`Failed to load reflector prompt from ${PROMPTS_PATH}`);
    return "";
  }
}

const DEFAULT_REFLECTION_PROMPT = loadReflectorPrompt();

export class Reflector {
  private config: KrabConfig;
  private options: ReflectionOptions;
  private reflectionModel?: any; // Different model for reflection if configured

  constructor(config: KrabConfig, options: Partial<ReflectionOptions> = {}) {
    this.config = config;
    this.options = {
      enabled: true,
      threshold: 70,
      maxRetries: 2,
      useSeparateModel: false,
      reflectionPrompt: DEFAULT_REFLECTION_PROMPT,
      ...options,
    };

    if (this.options.useSeparateModel) {
      // TODO: Configure separate model for reflection
      // this.reflectionModel = createModel(separateProviderConfig);
    }
  }

  async reflect(
    userInput: string,
    agentResponse: string,
    conversationHistory: Message[],
    toolCalls?: any[],
    signal?: AbortSignal,
  ): Promise<ReflectionResult> {
    if (!this.options.enabled) {
      return {
        quality: "good",
        score: 85,
        feedback: "Reflection disabled",
        suggestions: [],
        shouldRetry: false,
      };
    }

    try {
      // Prepare reflection prompt
      const reflectionInput = this.buildReflectionInput(
        userInput,
        agentResponse,
        conversationHistory,
        toolCalls,
      );

      // Generate reflection using LLM
      const reflectionMessages: Message[] = [
        {
          role: "system",
          content: this.options.reflectionPrompt!,
        },
        {
          role: "user",
          content: reflectionInput,
        },
      ];

      const reflectionOutput = await generateStructured(
        this.reflectionModel || this.config.provider,
        reflectionMessages,
        signal,
      );

      // Parse reflection result
      const result = this.parseReflectionOutput(reflectionOutput.response);

      logger.debug(
        `[Reflector] Quality: ${result.quality}, Score: ${result.score}`,
      );

      return result;
    } catch (error) {
      logger.error(`[Reflector] Reflection failed: ${error}`);
      // Fallback: assume response is acceptable
      return {
        quality: "good",
        score: 75,
        feedback: `Reflection failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestions: ["Consider manual review"],
        shouldRetry: false,
      };
    }
  }

  private buildReflectionInput(
    userQuery: string,
    agentResponse: string,
    conversationHistory: Message[],
    toolCalls?: any[],
  ): string {
    let input = `## User Query
${userQuery}

## Agent Response
${agentResponse}

## Conversation Context
${conversationHistory
  .slice(-5)
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n")}

`;

    if (toolCalls && toolCalls.length > 0) {
      input += `## Tool Calls Used
${toolCalls.map((call) => `- ${call.name}(${JSON.stringify(call.args)})`).join("\n")}

`;
    }

    input += `## Evaluation Task
Please evaluate the agent's response according to the criteria provided.
Focus on whether this response adequately addresses the user's needs and maintains high quality standards.`;

    return input;
  }

  private parseReflectionOutput(response: string): ReflectionResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in reflection response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the result
      return {
        quality: this.validateQuality(parsed.quality),
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        feedback: parsed.feedback || "No feedback provided",
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
        shouldRetry: parsed.shouldRetry || false,
        improvedResponse: parsed.improvedResponse,
      };
    } catch (error) {
      logger.warn(`[Reflector] Failed to parse reflection output: ${error}`);
      // Return a neutral result
      return {
        quality: "needs_improvement",
        score: 50,
        feedback: "Failed to parse reflection result",
        suggestions: ["Consider manual review of the response"],
        shouldRetry: true,
      };
    }
  }

  private validateQuality(
    quality: string,
  ): "excellent" | "good" | "needs_improvement" | "poor" {
    const validQualities = ["excellent", "good", "needs_improvement", "poor"];
    return validQualities.includes(quality)
      ? (quality as any)
      : "needs_improvement";
  }

  // Batch reflection for multiple responses
  async reflectBatch(
    evaluations: Array<{
      userQuery: string;
      agentResponse: string;
      conversationHistory: Message[];
      toolCalls?: any[];
    }>,
  ): Promise<ReflectionResult[]> {
    const promises = evaluations.map((evaluation) =>
      this.reflect(
        evaluation.userQuery,
        evaluation.agentResponse,
        evaluation.conversationHistory,
        evaluation.toolCalls,
      ),
    );

    return await Promise.all(promises);
  }

  // Get reflection statistics
  getStats(): {
    enabled: boolean;
    threshold: number;
    maxRetries: number;
    useSeparateModel: boolean;
  } {
    return {
      enabled: this.options.enabled,
      threshold: this.options.threshold,
      maxRetries: this.options.maxRetries,
      useSeparateModel: this.options.useSeparateModel,
    };
  }

  // Update reflection options
  updateOptions(newOptions: Partial<ReflectionOptions>): void {
    this.options = { ...this.options, ...newOptions };
    logger.info(`[Reflector] Options updated: ${JSON.stringify(newOptions)}`);
  }

  // Learning from reflections (for future improvement)
  async learnFromReflection(
    userQuery: string,
    originalResponse: string,
    reflection: ReflectionResult,
    finalResponse: string,
  ): Promise<void> {
    // TODO: Implement learning mechanism
    // Could store reflection results for pattern analysis
    // Or fine-tune the model based on reflection feedback

    logger.debug(
      `[Reflector] Learning from reflection (score: ${reflection.score})`,
    );
  }
}

// Quality-based decision making
export function shouldRetryBasedOnQuality(
  result: ReflectionResult,
  threshold: number,
): boolean {
  return result.score < threshold || result.shouldRetry;
}

export function getQualityColor(quality: string): string {
  switch (quality) {
    case "excellent":
      return "🟢";
    case "good":
      return "🟡";
    case "needs_improvement":
      return "🟠";
    case "poor":
      return "🔴";
    default:
      return "⚪";
  }
}

export function formatReflectionSummary(result: ReflectionResult): string {
  const color = getQualityColor(result.quality);
  return `${color} ${result.quality.toUpperCase()} (${result.score}/100)`;
}
