/**
 * Rich console styling utilities for Krab.
 * Provides HEX colors and gradient utilities using truecolor ANSI sequences.
 */

// -----------------
// 🎨 COLOR PALETTE
// -----------------
export const COLORS = {
  primary: "#ff9500", // Orange
  secondary: "#ff6b35", // Deep orange
  accent: "#ff9f1c", // Bright orange
  warning: "#ffd93d", // Yellow
  error: "#ff6b6b", // Red
  success: "#00ff9f", // Neon green
  info: "#6c5ce7", // Purple
  gray: "#666666",
};

// -----------------
// 🎨 ASCII LOGO
// -----------------
export const ASCII_LOGO = `
░█░█░█▀▄░█▀█░█▀▄░░░█░█░█▀▄░█▀█░█▀▄
░█▀▄░█▀▄░█▀█░█▀▄░░░█▀▄░█▀▄░█▀█░█▀▄
░▀░▀░▀░▀░▀░▀░▀▀░░░░▀░▀░▀░▀░▀░▀░▀▀░
`;

// -----------------
// 🚀 UTILS
// -----------------

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [255, 255, 255]; // default white
}

function applyHexColor(
  text: string,
  hex: string,
  bold: boolean = false,
): string {
  const [r, g, b] = hexToRgb(hex);
  const boldCode = bold ? "\x1b[1m" : "";
  const resetCode = bold ? "\x1b[22m\x1b[39m" : "\x1b[39m";
  return `${boldCode}\x1b[38;2;${r};${g};${b}m${text}${resetCode}`;
}

/**
 * Creates a split gradient-like effect across a string of text.
 * Very similar to the original Python implementation.
 */
export function generateGradientText(
  text: string,
  color1: string = COLORS.primary,
  color2: string = COLORS.secondary,
): string {
  const length = text.length;
  const mid = Math.floor(length / 2);
  const left = text.substring(0, mid);
  const right = text.substring(mid);

  return applyHexColor(left, color1, true) + applyHexColor(right, color2, true);
}

export function printBanner(
  subtitle: string = "Krab - Polymarket Trading Bot",
) {
  const lines = ASCII_LOGO.split("\n").filter(Boolean);
  lines.forEach((line) => {
    console.log(generateGradientText(line, COLORS.primary, COLORS.secondary));
  });

  const divider = "─".repeat(60);
  console.log(generateGradientText(divider, COLORS.primary, COLORS.secondary));
  console.log(`  🦀 ${applyHexColor(subtitle, COLORS.primary, true)}`);
  console.log(generateGradientText(divider, COLORS.primary, COLORS.secondary));
  console.log();
}

export function printSection(title: string) {
  console.log();
  const c = COLORS.secondary;
  const t = title.padEnd(56, " ");
  console.log(`${applyHexColor("┌" + "─".repeat(58) + "┐", c)}`);
  console.log(
    `${applyHexColor("│", c)} \x1b[1m\x1b[36m${t}\x1b[0m ${applyHexColor("│", c)}`,
  );
  console.log(`${applyHexColor("└" + "─".repeat(58) + "┘", c)}`);
}

export function printSuccess(message: string) {
  console.log(`  ${applyHexColor("✓", COLORS.success, true)} ${message}`);
}

export function printError(message: string) {
  console.log(`  ${applyHexColor("✗", COLORS.error, true)} ${message}`);
}

export function printWarning(message: string) {
  console.log(`  ${applyHexColor("⚠", COLORS.warning, true)} ${message}`);
}

export function printInfo(message: string) {
  console.log(`  ${applyHexColor("ℹ", COLORS.info, true)} ${message}`);
}

export function printKeyValue(key: string, value: string, indent: number = 2) {
  const spaces = " ".repeat(indent);
  const bullet = applyHexColor("●", "#00ffff");
  const coloredKey = applyHexColor(key + ":", COLORS.gray);
  console.log(`${spaces}${bullet} ${coloredKey} \x1b[37m${value}\x1b[0m`);
}
