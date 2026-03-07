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
import { printBanner, printKeyValue, COLORS } from "./style.js";

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

/**
 * Basic TUI-friendly markdown styler for Krab
 */
function styleMarkdown(text: string): string {
  let styled = text;

  // Code blocks: ```language ... ```
  styled = styled.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const head = pc.bgBlack(pc.dim(` 📝 ${lang || "code"} `));
    const body = pc.bgBlack(pc.cyan(code));
    return `\n${head}\n${body}`;
  });

  // Inline Code: `code`
  styled = styled.replace(/`([^`]+)`/g, pc.bgBlack(pc.cyan(" $1 ")));

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
    console.log(pc.dim(i18n.wizard_hint));
    console.log(pc.cyan(i18n.wizard_command));
    return;
  }

  const agent = new Agent(config);
  const messages: ChatMessage[] = [];

  // Header
  // The ASCII banner replaces the generic text header
  printBanner(i18n.header || "Interactive Chat TUI");
  printKeyValue("Provider", config.provider.name);
  printKeyValue("Model", config.provider.model);

  console.log(pc.dim("\n  " + i18n.command_hint));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(
        `  \x1B[38;2;255;107;107m▶\x1B[0m \x1B[1m\x1B[36mYou:\x1B[0m `,
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
          console.log(pc.dim(i18n.bye));
          rl.close();
          return;

        case "clear":
        case "cls":
          console.clear();
          printBanner(i18n.header || "Interactive Chat TUI");
          printKeyValue("Provider", config.provider.name);
          printKeyValue("Model", config.provider.model);
          console.log("");
          messages.length = 0;
          continue;

        case "help":
        case "?":
          console.log(pc.dim(i18n.help_title));
          console.log(i18n.help_exit);
          console.log(i18n.help_clear);
          console.log(i18n.help_help);
          console.log(i18n.help_model);
          console.log(i18n.help_memory);
          continue;

        case "model":
          console.log(pc.dim(`\nProvider: ${config.provider.name}`));
          console.log(pc.dim(`Model: ${config.provider.model}\n`));
          continue;

        case "memory":
          const stats = agent.getMemoryStats();
          console.log(
            pc.dim(
              `\nMemory: ${stats.totalMessages} messages in ${stats.totalConversations} conversations`,
            ),
          );
          console.log(pc.dim(`Limit: ${config.memoryLimit || 50}\n`));
          continue;

        default:
          console.log(
            pc.yellow(i18n.unknown_cmd.replace("{command}", command)),
          );
          console.log(pc.dim(i18n.help_hint));
          continue;
      }
    }

    // Skip empty messages
    if (!input.trim()) continue;

    // Add user message
    messages.push({
      role: "user",
      content: input,
      timestamp: new Date(),
    });

    // Show thinking indicator
    process.stdout.write(pc.dim(i18n.thinking));

    try {
      // Get response from agent
      const response = await agent.chat(input);

      // Clear thinking indicator
      process.stdout.write("\r" + " ".repeat(20) + "\r");

      // Format and Print response
      const styledResponse = styleMarkdown(response);
      console.log(
        `\n  \x1B[38;2;0;255;159m●\x1B[0m \x1B[1m\x1B[38;2;255;149;0mKrab\x1B[0m`,
      );
      console.log(
        `  ${pc.gray("│")} ${styledResponse.replace(/\n/g, `\n  ${pc.gray("│")} `)}\n`,
      );

      // Add to history
      messages.push({
        role: "assistant",
        content: response,
        timestamp: new Date(),
      });
    } catch (err: any) {
      process.stdout.write("\r" + " ".repeat(20) + "\r");
      console.log(pc.red(i18n.error_prefix) + err.message + "\n");
    }
  }

  rl.close();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChat().catch(console.error);
}
