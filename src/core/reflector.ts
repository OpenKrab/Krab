// ============================================================
// 🦀 Krab — Reflector (Agent Self-Review System)
// ============================================================
import { generateStructured } from "../providers/llm.js";
import { logger } from "../utils/logger.js";
import type { Message, KrabConfig } from "./types.js";

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

const DEFAULT_REFLECTION_PROMPT = `You are a Reflection Agent. Your task is to evaluate the quality of another AI assistant's response.

## Evaluation Criteria
1. **Accuracy**: Is the information correct and factual?
2. **Completeness**: Does it fully answer the user's question?
3. **Clarity**: Is the response clear and easy to understand?
4. **Helpfulness**: Is it genuinely helpful to the user?
5. **Safety**: Does it avoid harmful or inappropriate content?

## Response Format (JSON only)
{
  "quality": "excellent" | "good" | "needs_improvement" | "poor",
  "score": 0-100,
  "feedback": "Brief explanation of the evaluation",
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "shouldRetry": true/false,
  "improvedResponse": "Optional improved version of the response"
}

## Guidelines
- Be constructive and specific in feedback
- Only suggest improvements when truly needed
- Consider the context and user's intent
- Focus on substance over style
- If the response is good, acknowledge what's good about it`;

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
      ...options
    };

    if (this.options.useSeparateModel) {
      // TODO: Configure separate model for reflection
      // this.reflectionModel = createModel(separateProviderConfig);
    }
  }

  async reflect(
    userQuery: string,
    agentResponse: string,
    conversationHistory: Message[],
    toolCalls?: any[]
  ): Promise<ReflectionResult> {
    if (!this.options.enabled) {
      return {
        quality: "good",
        score: 85,
        feedback: "Reflection disabled",
        suggestions: [],
        shouldRetry: false
      };
    }

    try {
      // Prepare reflection prompt
      const reflectionInput = this.buildReflectionInput(
        userQuery,
        agentResponse,
        conversationHistory,
        toolCalls
      );

      // Generate reflection using LLM
      const reflectionMessages: Message[] = [
        {
          role: "system",
          content: this.options.reflectionPrompt!
        },
        {
          role: "user",
          content: reflectionInput
        }
      ];

      const reflectionOutput = await generateStructured(
        this.reflectionModel || this.config.provider,
        reflectionMessages
      );

      // Parse reflection result
      const result = this.parseReflectionOutput(reflectionOutput.response);

      logger.debug(`[Reflector] Quality: ${result.quality}, Score: ${result.score}`);

      return result;

    } catch (error) {
      logger.error(`[Reflector] Reflection failed: ${error}`);
      // Fallback: assume response is acceptable
      return {
        quality: "good",
        score: 75,
        feedback: `Reflection failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestions: ["Consider manual review"],
        shouldRetry: false
      };
    }
  }

  private buildReflectionInput(
    userQuery: string,
    agentResponse: string,
    conversationHistory: Message[],
    toolCalls?: any[]
  ): string {
    let input = `## User Query
${userQuery}

## Agent Response
${agentResponse}

## Conversation Context
${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

`;

    if (toolCalls && toolCalls.length > 0) {
      input += `## Tool Calls Used
${toolCalls.map(call => `- ${call.name}(${JSON.stringify(call.args)})`).join('\n')}

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
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        shouldRetry: parsed.shouldRetry || false,
        improvedResponse: parsed.improvedResponse
      };

    } catch (error) {
      logger.warn(`[Reflector] Failed to parse reflection output: ${error}`);
      // Return a neutral result
      return {
        quality: "needs_improvement",
        score: 50,
        feedback: "Failed to parse reflection result",
        suggestions: ["Consider manual review of the response"],
        shouldRetry: true
      };
    }
  }

  private validateQuality(quality: string): "excellent" | "good" | "needs_improvement" | "poor" {
    const validQualities = ["excellent", "good", "needs_improvement", "poor"];
    return validQualities.includes(quality) ? quality as any : "needs_improvement";
  }

  // Batch reflection for multiple responses
  async reflectBatch(
    evaluations: Array<{
      userQuery: string;
      agentResponse: string;
      conversationHistory: Message[];
      toolCalls?: any[];
    }>
  ): Promise<ReflectionResult[]> {
    const promises = evaluations.map(evaluation =>
      this.reflect(evaluation.userQuery, evaluation.agentResponse, evaluation.conversationHistory, evaluation.toolCalls)
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
      useSeparateModel: this.options.useSeparateModel
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
    finalResponse: string
  ): Promise<void> {
    // TODO: Implement learning mechanism
    // Could store reflection results for pattern analysis
    // Or fine-tune the model based on reflection feedback

    logger.debug(`[Reflector] Learning from reflection (score: ${reflection.score})`);
  }
}

// Quality-based decision making
export function shouldRetryBasedOnQuality(result: ReflectionResult, threshold: number): boolean {
  return result.score < threshold || result.shouldRetry;
}

export function getQualityColor(quality: string): string {
  switch (quality) {
    case "excellent": return "🟢";
    case "good": return "🟡";
    case "needs_improvement": return "🟠";
    case "poor": return "🔴";
    default: return "⚪";
  }
}

export function formatReflectionSummary(result: ReflectionResult): string {
  const color = getQualityColor(result.quality);
  return `${color} ${result.quality.toUpperCase()} (${result.score}/100)`;
}
