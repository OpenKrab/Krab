// ============================================================
// 🦀 Krab — Onboarding Types
// ============================================================
import { z } from "zod";

export const OnboardingChannelSchema = z.object({
  channel: z.string(),
  enabled: z.boolean().default(false),
  configured: z.boolean().default(false),
  status: z.enum(["not_setup", "configuring", "configured", "error"]).default("not_setup"),
  error: z.string().optional(),
});

export type OnboardingChannel = z.infer<typeof OnboardingChannelSchema>;

export interface OnboardingOptions {
  allowDisable?: boolean;
  allowSkip?: boolean;
  quickstartDefaults?: boolean;
  initialSelection?: string[];
  promptAccountIds?: boolean;
  skipDmPolicyPrompt?: boolean;
  skipConfirm?: boolean;
}

export interface OnboardingStatus {
  channel: string;
  configured: boolean;
  statusLines: string[];
  selectionHint?: string;
  quickstartScore?: number;
}

export interface OnboardingContext {
  channel: string;
  configured: boolean;
  label: string;
  accountId?: string;
  config: Record<string, unknown>;
}

export interface OnboardingResult {
  success: boolean;
  channel: string;
  config?: Record<string, unknown>;
  error?: string;
}

export interface OnboardingAdapter {
  channel: string;
  getStatus: (ctx: OnboardingContext) => Promise<OnboardingStatus>;
  configure: (ctx: OnboardingContext) => Promise<OnboardingResult>;
  configureInteractive?: (ctx: OnboardingContext) => Promise<OnboardingResult | "skip">;
  getDmPolicyOptions?: () => { label: string; value: string }[];
  getRequiredFields?: () => { key: string; label: string; type: "string" | "password" | "number" }[];
}

// ── Wizard Types ─────────────────────────────────────────────────

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  validate?: (value: unknown) => boolean;
  transform?: (value: unknown) => unknown;
}

export interface WizardPrompt {
  type: "text" | "password" | "select" | "confirm" | "multiselect";
  message: string;
  options?: { label: string; value: string }[];
  default?: unknown;
  required?: boolean;
}

export interface WizardContext {
  channel: string;
  answers: Record<string, unknown>;
  currentStep: number;
}

export interface WizardCallbacks {
  onStep?: (step: WizardStep) => void;
  onComplete?: (answers: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}
