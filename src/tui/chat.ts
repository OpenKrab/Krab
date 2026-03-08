// ============================================================
// 🦀 Krab — Interactive Chat TUI
// ============================================================
import * as p from "@clack/prompts";
import pc from "picocolors";
import { Agent } from "../core/agent.js";
import { loadConfig } from "../core/config.js";
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { printBanner, printKeyValue, printSection, printInfo, printWarning, COLORS } from "./style.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const I18N_PATH = resolve(__dirname, "i18n.json");

function loadI18n() {
  try {
    return JSON.parse(readFileSync(I18N_PATH, "utf-8"));
  } catch (error) {
    return { chat: {} };
  }
}

const i18n = loadI18n().chat;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

function renderTranscriptEntry(message: ChatMessage): void {
  const timestamp = pc.dim(message.timestamp.toLocaleTimeString());
  if (message.role === "user") {
    console.log(`  ${pc.bold(pc.yellow("◉ OPERATOR"))} ${timestamp}`);
    console.log(`  ${pc.gray("║")} ${message.content.replace(/\n/g, `\n  ${pc.gray("║")} `)}`);
    console.log("");
    return;
  }

  if (message.role === "assistant") {
    console.log(`  ${pc.bold(pc.green("◉ KRAB"))} ${timestamp}`);
    console.log(`  ${pc.gray("║")} ${styleMarkdown(message.content).replace(/\n/g, `\n  ${pc.gray("║")} `)}`);
    console.log("");
    return;
  }

  console.log(`  ${pc.bold(pc.cyan("◉ SYSTEM"))} ${timestamp}`);
  console.log(`  ${pc.gray("║")} ${message.content.replace(/\n/g, `\n  ${pc.gray("║")} `)}`);
  console.log("");
}

/**
 * Basic TUI-friendly markdown styler for Krab
 */
function styleMarkdown(text: string): string {
  let styled = text;

  // Code blocks: ```language ... ```
  styled = styled.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const head = ` ${pc.bold(pc.yellow("▣"))} ${pc.bold(pc.cyan((lang || "code").toUpperCase()))} `;
    const body = pc.cyan(code);
    return `\n${head}\n${body}`;
  });

  // Inline Code: `code`
  styled = styled.replace(/`([^`]+)`/g, `${pc.bold(pc.yellow("‹"))}${pc.cyan("$1")}${pc.bold(pc.yellow("›"))}`);

  // Bold: **text**
  styled = styled.replace(/\*\*([^*]+)\*\*/g, pc.bold(pc.yellow("$1")));

  // Italics: *text*
  styled = styled.replace(
    /(^|[^\w*])\*([^*]+)\*(?=[^\w*]|$)/g,
    `$1${pc.italic(pc.magenta("$2"))}`,
  );

  return styled;
}

export async function runChat() {
  console.clear();

  // Load config
  let config;
  try {
    config = loadConfig();
  } catch (err: any) {
    p.outro(pc.red(i18n.config_error.replace("{error}", err.message)));
    printWarning(i18n.wizard_hint);
    console.log(pc.cyan(i18n.wizard_command));
    return;
  }

  const agent = new Agent(config);
  const messages: ChatMessage[] = [];

  // Header
  printBanner(i18n.header || "Interactive Chat TUI");
  printKeyValue("Provider", config.provider.name);
  printKeyValue("Model", config.provider.model);
  printSection("Chat Reactor");
  printInfo(i18n.command_hint);

  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(
        `  ${pc.bold(pc.yellow("◉"))} ${pc.bold(pc.cyan("operator"))}${pc.dim(" :: transmit> ")}`,
        (answer) => {
          resolve(answer);
        },
      );
    });
  };

  // Chat loop
  while (true) {
    const input = await askQuestion();

    // Handle commands
    if (input.startsWith("/")) {
      const command = input.slice(1).toLowerCase();

      switch (command) {
        case "exit":
        case "quit":
        case "q":
          printInfo(i18n.bye);
          rl.close();
          return;

        case "clear":
        case "cls":
          console.clear();
          printBanner(i18n.header || "Interactive Chat TUI");
          printKeyValue("Provider", config.provider.name);
          printKeyValue("Model", config.provider.model);
          printSection("Chat Reactor");
          printInfo(i18n.command_hint);
          console.log("");
          messages.length = 0;
          continue;

        case "help":
        case "?":
          printSection("Command Reference");
          console.log(pc.dim(i18n.help_title));
          console.log(i18n.help_exit);
          console.log(i18n.help_clear);
          console.log(i18n.help_help);
          console.log(i18n.help_model);
          console.log(i18n.help_memory);
          console.log("");
          continue;

        case "model":
          printSection("Model Readout");
          printKeyValue("Provider", config.provider.name);
          printKeyValue("Model", config.provider.model);
          console.log("");
          continue;

        case "memory":
          const stats = agent.getMemoryStats();
          printSection("Memory Reservoir");
          printKeyValue("Messages", String(stats.totalMessages));
          printKeyValue("Conversations", String(stats.totalConversations));
          printKeyValue("Limit", String(config.memoryLimit || 50));
          console.log("");
          continue;

        default:
          printWarning(i18n.unknown_cmd.replace("{command}", command));
          printInfo(i18n.help_hint);
          continue;
      }
    }

    // Skip empty messages
    if (!input.trim()) continue;

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    messages.push(userMessage);
    renderTranscriptEntry(userMessage);

    // Show thinking indicator
    process.stdout.write(pc.dim("⌁ calibrating reactor thought-path..."));

    try {
      // Get response from agent
      const response = await agent.chat(input);

      // Clear thinking indicator
      process.stdout.write("\r" + " ".repeat(48) + "\r");

      printSection("Assistant");
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      messages.push(assistantMessage);
      renderTranscriptEntry(assistantMessage);
    } catch (err: any) {
      process.stdout.write("\r" + " ".repeat(48) + "\r");
      printWarning(i18n.error_prefix + err.message);
      console.log("");
    }
  }

  rl.close();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChat().catch(console.error);
}
