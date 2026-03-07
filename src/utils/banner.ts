// ============================================================
// 🦀 Krab — Banner Configuration
// ============================================================
import pc from "picocolors";
import { taglines, getRandomTagline } from "./taglines.js";

export interface BannerConfig {
  title: string;
  subtitle: string;
  taglines: string[];
  borderColor?: "red" | "blue" | "green" | "yellow" | "cyan" | "magenta";
}

const ASCII_LOGO = [
  "░█░█░█▀▄░█▀█░█▀▄",
  "░█▀▄░█▀▄░█▀█░█▀▄",
  "░▀░▀░▀░▀░▀░▀░▀▀░",
];

export const defaultBannerConfig: BannerConfig = {
  title: "K R A B  —  AI Assistant Framework",
  subtitle: "Neutral, reliable, and focused",
  taglines: taglines.default,
  borderColor: "red"
};

export function showBanner(config: Partial<BannerConfig> = {}): void {
  const finalConfig = { ...defaultBannerConfig, ...config };
  const randomTagline = finalConfig.taglines[Math.floor(Math.random() * finalConfig.taglines.length)];
  
  const colorFn = pc[finalConfig.borderColor || "red"] || pc.red;
  
  const line = "─".repeat(60);
  const banner = [
    "",
    ...ASCII_LOGO,
    line,
    finalConfig.title,
    finalConfig.subtitle,
    `\"${randomTagline}\"`,
    line,
    "",
  ].join("\n");

  console.log(colorFn(banner));
}

// Predefined banner themes
export const bannerThemes = {
  default: defaultBannerConfig,
  
  minimal: {
    ...defaultBannerConfig,
    title: "K R A B",
    subtitle: "AI Framework",
    taglines: taglines.minimal,
    borderColor: "blue" as const
  },
  
  professional: {
    ...defaultBannerConfig,
    title: "K R A B  —  Enterprise AI Framework",
    subtitle: "Professional AI Solutions",
    taglines: taglines.professional,
    borderColor: "blue" as const
  },
  
  playful: {
    ...defaultBannerConfig,
    title: "🦀 K R A B  —  Your AI Friend",
    subtitle: "Making AI fun!",
    taglines: taglines.playful,
    borderColor: "yellow" as const
  },
  
  tech: {
    ...defaultBannerConfig,
    title: "K R A B  —  Next-Gen AI",
    subtitle: "Future of Intelligence",
    taglines: taglines.tech,
    borderColor: "cyan" as const
  }
};

// Export for dynamic loading
export default showBanner;
