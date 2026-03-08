/**
 * Rich console styling utilities for Krab.
 * Provides HEX colors and gradient utilities using truecolor ANSI sequences.
 */

import pc from "picocolors";

// -----------------
// 🎨 COLOR PALETTE
// -----------------
export const COLORS = {
  primary: "#9BFF3A",
  secondary: "#36D9A4",
  accent: "#FFB000",
  warning: "#FFD95A",
  error: "#FF6B4A",
  success: "#A7FF4F",
  info: "#7AE7FF",
  gray: "#7E8A7A",
  panel: "#1E3A2F",
  chrome: "#4B5F4C",
};

export const TAGLINE = "KRAB // RETROFUTURE CONTROL GRID";

// -----------------
// 🎨 ASCII LOGO
// -----------------
export const ASCII_LOGO = `
 █▄▀ █▀█ ▄▀█ █▄▄
 █░█ █▀▄ █▀█ █▄█
 ATOM-PUNK CONTROL
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

export function applyHexColor(text: string, hex: string, bold: boolean = false): string {
  // Fallback to basic color application since advanced ANSI methods may not be supported
  const color = hex.toLowerCase() === COLORS.primary.toLowerCase() ? pc.green :
                hex.toLowerCase() === COLORS.secondary.toLowerCase() ? pc.cyan :
                hex.toLowerCase() === COLORS.warning.toLowerCase() ? pc.yellow :
                hex.toLowerCase() === COLORS.panel.toLowerCase() ? pc.gray :
                hex.toLowerCase() === COLORS.accent.toLowerCase() ? pc.magenta :
                hex.toLowerCase() === COLORS.success.toLowerCase() ? pc.green :
                hex.toLowerCase() === COLORS.info.toLowerCase() ? pc.blue :
                hex.toLowerCase() === COLORS.warning.toLowerCase() ? pc.yellow :
                hex.toLowerCase() === COLORS.error.toLowerCase() ? pc.red : pc.white;
  return bold ? pc.bold(color(text)) : color(text);
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
  subtitle: string = TAGLINE,
) {
  const lines = ASCII_LOGO.split("\n").filter(Boolean);
  lines.forEach((line) => {
    console.log(generateGradientText(line, COLORS.primary, COLORS.secondary));
  });

  const divider = "─".repeat(60);
  console.log(generateGradientText(divider, COLORS.chrome, COLORS.secondary));
  console.log(`  ${applyHexColor("◉", COLORS.accent, true)} ${applyHexColor(subtitle, COLORS.primary, true)}`);
  console.log(`  ${applyHexColor("◌", COLORS.info, true)} ${applyHexColor("REACTOR ONLINE // SIGNAL CLEAN // COMMAND AUTHORIZED", COLORS.gray)}`);
  console.log(generateGradientText(divider, COLORS.chrome, COLORS.secondary));
  console.log();
}

export function printSection(title: string) {
  console.log();
  const c = COLORS.chrome;
  const t = title.padEnd(56, " ");
  const s = "SECTOR HUD // ATOMPUNK OPERATIONS".padEnd(56, " ");
  console.log(`${applyHexColor("╔" + "═".repeat(58) + "╗", c)}`);
  console.log(
    `${applyHexColor("║", c)} ${applyHexColor("◉ " + t.slice(0, 54), COLORS.accent, true)} ${applyHexColor("║", c)}`,
  );
  console.log(
    `${applyHexColor("║", c)} ${applyHexColor(s, COLORS.primary, true)} ${applyHexColor("║", c)}`,
  );
  console.log(`${applyHexColor("╚" + "═".repeat(58) + "╝", c)}`);
}

export function printSuccess(message: string) {
  console.log(`  ${applyHexColor("✓", COLORS.success, true)} ${message}`);
}

export function printError(message: string) {
  console.log(`  ${applyHexColor("✗", COLORS.error, true)} ${message}`);
}

export function printWarning(message: string) {
  console.log(`  ${applyHexColor("☢", COLORS.warning, true)} ${message}`);
}

export function printInfo(message: string) {
  console.log(`  ${applyHexColor("⌁", COLORS.info, true)} ${message}`);
}

export function printKeyValue(key: string, value: string, indent: number = 2) {
  const spaces = " ".repeat(indent);
  const bullet = applyHexColor("▣", COLORS.accent, true);
  const coloredKey = applyHexColor(key.toUpperCase() + ":", COLORS.gray, true);
  console.log(`${spaces}${bullet} ${coloredKey} ${applyHexColor(value, COLORS.info)}`);
}
