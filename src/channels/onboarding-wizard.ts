// ============================================================
// 🦀 Krab — Onboarding Wizard
// ============================================================
import { logger } from "../utils/logger.js";
import { ChannelRegistry } from "./registry.js";
import type { 
  OnboardingOptions, 
  OnboardingStatus, 
  OnboardingContext,
  OnboardingAdapter,
  WizardStep,
  WizardPrompt,
  WizardContext,
  WizardCallbacks
} from "./onboarding-types.js";

export interface ChannelOnboardingInfo {
  id: string;
  name: string;
  platform: string;
  description: string;
  icon?: string;
  requiredFields: { key: string; label: string; type: "string" | "password" | "number" }[];
  optionalFields?: { key: string; label: string; type: "string" | "password" | "number" }[];
  dmPolicyOptions?: { label: string; value: string }[];
}

export class OnboardingWizard {
  private adapters = new Map<string, OnboardingAdapter>();
  private channelInfo: ChannelOnboardingInfo[] = [];
  private options: OnboardingOptions;

  constructor(options: OnboardingOptions = {}) {
    this.options = options;
  }

  registerAdapter(adapter: OnboardingAdapter): void {
    this.adapters.set(adapter.channel, adapter);
    logger.debug(`[OnboardingWizard] Registered adapter for: ${adapter.channel}`);
  }

  registerChannelInfo(info: ChannelOnboardingInfo): void {
    this.channelInfo.push(info);
  }

  getAvailableChannels(): ChannelOnboardingInfo[] {
    return [...this.channelInfo];
  }

  getChannelInfo(channelId: string): ChannelOnboardingInfo | undefined {
    return this.channelInfo.find((c) => c.id === channelId);
  }

  async getStatus(channelId: string): Promise<OnboardingStatus> {
    const adapter = this.adapters.get(channelId);
    if (!adapter) {
      return {
        channel: channelId,
        configured: false,
        statusLines: ["Channel not supported"],
      };
    }

    const ctx: OnboardingContext = {
      channel: channelId,
      configured: false,
      label: this.getChannelInfo(channelId)?.name || channelId,
      config: {},
    };

    return adapter.getStatus(ctx);
  }

  async configure(channelId: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    const adapter = this.adapters.get(channelId);
    if (!adapter) {
      return { success: false, error: "Channel not supported" };
    }

    const ctx: OnboardingContext = {
      channel: channelId,
      configured: false,
      label: this.getChannelInfo(channelId)?.name || channelId,
      config,
    };

    const result = await adapter.configure(ctx);
    return { success: result.success, error: result.error };
  }

  async runInteractive(channelId: string): Promise<{ success: boolean; error?: string }> {
    const adapter = this.adapters.get(channelId);
    if (!adapter?.configureInteractive) {
      return this.configure(channelId, {});
    }

    const ctx: OnboardingContext = {
      channel: channelId,
      configured: false,
      label: this.getChannelInfo(channelId)?.name || channelId,
      config: {},
    };

    const result = await adapter.configureInteractive(ctx);
    if (result === "skip") {
      return { success: true };
    }
    return { success: result.success, error: result.error };
  }

  async setupAll(
    selectedChannels: string[],
    configs: Map<string, Record<string, unknown>>
  ): Promise<{ success: string[]; failed: { channel: string; error: string }[] }> {
    const success: string[] = [];
    const failed: { channel: string; error: string }[] = [];

    for (const channelId of selectedChannels) {
      const config = configs.get(channelId) || {};
      const result = await this.configure(channelId, config);

      if (result.success) {
        success.push(channelId);
      } else {
        failed.push({ channel: channelId, error: result.error || "Unknown error" });
      }
    }

    return { success, failed };
  }

  // ── Quickstart Setup ────────────────────────────────────────────

  async quickstart(): Promise<{ success: boolean; configured: string[]; errors: string[] }> {
    if (!this.options.quickstartDefaults) {
      return { success: false, configured: [], errors: ["Quickstart not enabled"] };
    }

    const channels = this.options.initialSelection || this.getQuickstartChannels();
    const configs = this.getQuickstartConfigs(channels);

    const result = await this.setupAll(channels, configs);

    return {
      success: result.failed.length === 0,
      configured: result.success,
      errors: result.failed.map((f) => `${f.channel}: ${f.error}`),
    };
  }

  private getQuickstartChannels(): string[] {
    return ["telegram", "discord"].filter((ch) => {
      const info = this.channelInfo.find((c) => c.id === ch);
      return info?.requiredFields.length === 0;
    });
  }

  private getQuickstartConfigs(channels: string[]): Map<string, Record<string, unknown>> {
    const configs = new Map<string, Record<string, unknown>>();

    for (const channel of channels) {
      configs.set(channel, {
        enabled: true,
        dmPolicy: "open",
        groupPolicy: "open",
      });
    }

    return configs;
  }

  // ── Status Report ───────────────────────────────────────────────

  async getStatusReport(): Promise<{
    total: number;
    configured: number;
    notConfigured: number;
    channels: OnboardingStatus[];
  }> {
    const channels: OnboardingStatus[] = [];
    let configured = 0;
    let notConfigured = 0;

    for (const info of this.channelInfo) {
      const status = await this.getStatus(info.id);
      channels.push(status);

      if (status.configured) configured++;
      else notConfigured++;
    }

    return {
      total: this.channelInfo.length,
      configured,
      notConfigured,
      channels,
    };
  }
}

// ── Interactive Setup Prompts ───────────────────────────────────

export function createSetupPrompts(channelInfo: ChannelOnboardingInfo): WizardPrompt[] {
  const prompts: WizardPrompt[] = [];

  prompts.push({
    type: "confirm",
    message: `Enable ${channelInfo.name}?`,
    default: true,
  });

  for (const field of channelInfo.requiredFields) {
    prompts.push({
      type: field.type === "password" ? "password" : "text",
      message: field.label,
      required: true,
    });
  }

  if (channelInfo.dmPolicyOptions) {
    prompts.push({
      type: "select",
      message: "DM Policy:",
      options: channelInfo.dmPolicyOptions,
      default: "open",
    });
  }

  return prompts;
}

// ── Predefined Channel Info ─────────────────────────────────────

export const DEFAULT_CHANNEL_INFO: ChannelOnboardingInfo[] = [
  {
    id: "telegram",
    name: "Telegram",
    platform: "telegram",
    description: "Secure messaging with bots",
    icon: "✈️",
    requiredFields: [
      { key: "botToken", label: "Bot Token", type: "password" },
    ],
    dmPolicyOptions: [
      { label: "Open (anyone can DM)", value: "open" },
      { label: "Pairing required", value: "pairing" },
      { label: "Allowlist only", value: "allowlist" },
      { label: "Disabled", value: "disabled" },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    platform: "discord",
    description: "Community chat platform",
    icon: "🎮",
    requiredFields: [
      { key: "botToken", label: "Bot Token", type: "password" },
    ],
    dmPolicyOptions: [
      { label: "Open (anyone can DM)", value: "open" },
      { label: "Pairing required", value: "pairing" },
      { label: "Allowlist only", value: "allowlist" },
    ],
  },
  {
    id: "line",
    name: "LINE",
    platform: "line",
    description: "Popular in Thailand & Japan",
    icon: "💚",
    requiredFields: [
      { key: "channelAccessToken", label: "Channel Access Token", type: "password" },
      { key: "channelSecret", label: "Channel Secret", type: "password" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    platform: "whatsapp",
    description: "Meta's messaging platform",
    icon: "📱",
    requiredFields: [
      { key: "phoneNumberId", label: "Phone Number ID", type: "string" },
      { key: "accessToken", label: "Access Token", type: "password" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    platform: "slack",
    description: "Team communication",
    icon: "💬",
    requiredFields: [
      { key: "botToken", label: "Bot Token", type: "password" },
      { key: "signingSecret", label: "Signing Secret", type: "password" },
    ],
  },
];
