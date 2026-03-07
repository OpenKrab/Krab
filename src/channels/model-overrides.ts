// ============================================================
// 🦀 Krab — Model Overrides (Per-Channel AI Model)
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";

export const ModelOverrideSchema = z.object({
  channel: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
  enabled: z.boolean().default(true),
});

export type ModelOverride = z.infer<typeof ModelOverrideSchema>;

export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export class ModelOverrides {
  private overrides = new Map<string, ModelOverride>();
  private defaultConfig: ModelConfig;

  constructor(defaultConfig: ModelConfig) {
    this.defaultConfig = defaultConfig;
  }

  setOverride(override: ModelOverride): void {
    this.overrides.set(override.channel, override);
    logger.info(`[ModelOverrides] Set override for ${override.channel}: ${override.model}`);
  }

  removeOverride(channel: string): boolean {
    const removed = this.overrides.delete(channel);
    if (removed) {
      logger.info(`[ModelOverrides] Removed override for ${channel}`);
    }
    return removed;
  }

  getOverride(channel: string): ModelOverride | undefined {
    return this.overrides.get(channel);
  }

  getConfig(channel: string): ModelConfig {
    const override = this.overrides.get(channel);
    
    if (!override || !override.enabled) {
      return { ...this.defaultConfig };
    }

    return {
      provider: this.defaultConfig.provider,
      model: override.model,
      temperature: override.temperature ?? this.defaultConfig.temperature,
      maxTokens: override.maxTokens ?? this.defaultConfig.maxTokens,
      systemPrompt: override.systemPrompt ?? this.defaultConfig.systemPrompt,
    };
  }

  isEnabled(channel: string): boolean {
    const override = this.overrides.get(channel);
    return override?.enabled ?? false;
  }

  listOverrides(): ModelOverride[] {
    return Array.from(this.overrides.values());
  }

  hasOverride(channel: string): boolean {
    return this.overrides.has(channel);
  }
}

// ── Model Selector ───────────────────────────────────────────────

export type ModelSelectorStrategy = "default" | "channel" | "content" | "load-balanced";

export interface ModelSelectorOptions {
  strategy: ModelSelectorStrategy;
  fallbackModel?: string;
}

export class ModelSelector {
  private overrides: ModelOverrides;
  private options: ModelSelectorOptions;

  constructor(overrides: ModelOverrides, options: ModelSelectorOptions) {
    this.overrides = overrides;
    this.options = options;
  }

  select(channel: string, context?: {
    messageLength?: number;
    hasMedia?: boolean;
    priority?: "fast" | "balanced" | "quality";
  }): ModelConfig {
    switch (this.options.strategy) {
      case "channel":
        return this.overrides.getConfig(channel);

      case "content": {
        const config = this.overrides.getConfig(channel);
        
        if (context?.hasMedia) {
          return { ...config, model: this.selectForMedia(config.model) };
        }
        
        if ((context?.messageLength || 0) > 2000) {
          return { ...config, model: this.selectForLongContext(config.model) };
        }
        
        if (context?.priority === "quality") {
          return { ...config, model: this.selectForQuality(config.model) };
        }
        
        if (context?.priority === "fast") {
          return { ...config, model: this.selectForSpeed(config.model) };
        }
        
        return config;
      }

      case "load-balanced":
        return this.selectLoadBalanced(channel);

      case "default":
      default:
        return this.overrides.getConfig(channel);
    }
  }

  private selectForMedia(model: string): string {
    if (model.includes("vision") || model.includes("vision")) {
      return model;
    }
    return model.replace(/(-[\w]+)?$/, "-vision-1");
  }

  private selectForLongContext(model: string): string {
    if (model.includes("32k") || model.includes("128k")) {
      return model;
    }
    return model.replace(/(-[\w]+)?$/, "-32k");
  }

  private selectForQuality(model: string): string {
    const qualityMap: Record<string, string> = {
      "gpt-4o-mini": "gpt-4o",
      "claude-3-haiku": "claude-3-opus",
      "gemini-1.5-flash": "gemini-1.5-pro",
    };
    return qualityMap[model] || model;
  }

  private selectForSpeed(model: string): string {
    const speedMap: Record<string, string> = {
      "gpt-4o": "gpt-4o-mini",
      "claude-3-opus": "claude-3-haiku",
      "gemini-1.5-pro": "gemini-1.5-flash",
    };
    return speedMap[model] || model;
  }

  private selectLoadBalanced(channel: string): ModelConfig {
    const models = ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"];
    const index = Math.floor(Date.now() / (60 * 1000)) % models.length;
    const config = this.overrides.getConfig(channel);
    return { ...config, model: models[index] };
  }
}
