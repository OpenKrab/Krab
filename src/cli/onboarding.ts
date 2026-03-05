// ============================================================
// 🦀 Krab — Enhanced Onboarding Wizard (OpenClaw-inspired)
// ============================================================
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { getModels } from "../utils/model-fetcher.js";

const ENV_PATH = resolve(process.cwd(), ".env");
const KRAB_DIR = join(homedir(), ".krab");

// Generate random token
function generateToken(): string {
  return 'krab_' + randomBytes(32).toString('hex');
}

export async function runOnboarding() {
  console.clear();
  
  // Header
  p.intro(pc.bgCyan(pc.black(" 🦀 Krab Onboarding ")));
  
  // Step 1: Security Warning
  p.log.message(pc.yellow("⚠️  Security Warning — Please Read\n"));
  p.log.message([
    "Krab is a powerful AI agent framework that can:",
    "  • Execute shell commands",
    "  • Read and write files",
    "  • Search the web",
    "  • Access your system\n",
    "",
    "If you enable tools, a malicious prompt could trick the AI",
    "into performing unsafe actions.\n",
    "",
    pc.bold("Recommended security practices:"),
    "  • Use sandbox mode for untrusted inputs",
    "  • Enable tool approval for destructive actions",
    "  • Never expose sensitive credentials to the agent",
    "  • Use strong API keys and keep them secret",
    "  • Regularly audit with: krab security audit\n",
  ].join("\n"));
  
  const securityAck = await p.confirm({
    message: "I understand this is powerful and inherently risky. Continue?",
    initialValue: true,
  });
  
  if (!securityAck || p.isCancel(securityAck)) {
    p.cancel("Onboarding cancelled. Run 'krab onboard' when you're ready.");
    process.exit(0);
  }
  
  // Step 2: Select Setup Type
  const setupType = await p.select({
    message: "What do you want to set up?",
    options: [
      { 
        value: "local", 
        label: "🖥️  Local Agent (Recommended)",
        hint: "Run Krab on this machine only"
      },
      { 
        value: "gateway", 
        label: "🌐 Local Gateway",
        hint: "Run gateway server on this machine"
      },
      { 
        value: "minimal", 
        label: "⚡ Minimal Setup",
        hint: "Just the basics, configure later"
      },
    ],
  });
  
  if (p.isCancel(setupType)) {
    p.cancel("Onboarding cancelled.");
    process.exit(0);
  }
  
  const config: Record<string, string> = {};
  
  // Step 3: Gateway Configuration (if selected)
  if (setupType === "gateway") {
    p.log.step("Gateway Configuration");
    
    const workspace = await p.text({
      message: "Workspace directory:",
      initialValue: join(KRAB_DIR, "workspace"),
      placeholder: join(KRAB_DIR, "workspace"),
    });
    
    if (p.isCancel(workspace)) {
      p.cancel("Onboarding cancelled.");
      process.exit(0);
    }
    
    config["KRAB_WORKSPACE"] = workspace;
    
    // Create workspace directory
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
    }
    
    const port = await p.text({
      message: "Gateway port:",
      initialValue: "18789",
      placeholder: "18789",
      validate: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1024 || num > 65535) {
          return "Please enter a valid port number (1024-65535)";
        }
      },
    });
    
    if (p.isCancel(port)) {
      p.cancel("Onboarding cancelled.");
      process.exit(0);
    }
    
    config["KRAB_PORT"] = port;
    
    const bind = await p.select({
      message: "Gateway bind address:",
      options: [
        { value: "127.0.0.1", label: "🛡️  Loopback (127.0.0.1)", hint: "Most secure - localhost only" },
        { value: "0.0.0.0", label: "🌐 All interfaces (0.0.0.0)", hint: "Accessible from network" },
      ],
      initialValue: "127.0.0.1",
    });
    
    if (p.isCancel(bind)) {
      p.cancel("Onboarding cancelled.");
      process.exit(0);
    }
    
    config["KRAB_HOST"] = bind;
    
    const auth = await p.select({
      message: "Gateway authentication:",
      options: [
        { value: "token", label: "🔐 Token (Recommended)", hint: "Secure token-based auth" },
        { value: "none", label: "⚠️  No auth", hint: "Not recommended for production" },
      ],
      initialValue: "token",
    });
    
    if (p.isCancel(auth)) {
      p.cancel("Onboarding cancelled.");
      process.exit(0);
    }
    
    if (auth === "token") {
      const token = await p.text({
        message: "Gateway token (blank to generate):",
        placeholder: "Leave blank for auto-generation",
      });
      
      if (p.isCancel(token)) {
        p.cancel("Onboarding cancelled.");
        process.exit(0);
      }
      
      config["KRAB_GATEWAY_TOKEN"] = token || generateToken();
      
      if (!token) {
        p.log.success(`Generated token: ${config["KRAB_GATEWAY_TOKEN"].substring(0, 20)}...`);
      }
    }
  }
  
  // Step 4: LLM Provider Setup
  p.log.step("LLM Provider Setup");
  
  const provider = await p.select({
    message: "Select your AI provider:",
    options: [
      { value: "openrouter", label: "🌐 OpenRouter", hint: "Free models available" },
      { value: "google", label: "🌍 Google Gemini", hint: "Free tier available" },
      { value: "openai", label: "🤖 OpenAI", hint: "GPT-4, GPT-3.5" },
      { value: "anthropic", label: "🧠 Anthropic Claude", hint: "Claude models" },
      { value: "kilocode", label: "🚀 KiloCode", hint: "Free models available" },
      { value: "opencode", label: "⚡ OpenCode Zen", hint: "Free models available" },
      { value: "ollama", label: "💻 Ollama", hint: "Run models locally" },
    ],
  });
  
  if (p.isCancel(provider)) {
    p.cancel("Onboarding cancelled.");
    process.exit(0);
  }
  
  // Step 5: API Key (if needed)
  const envKeyMap: Record<string, string> = {
    openrouter: "OPENROUTER_API_KEY",
    google: "GEMINI_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    kilocode: "KILOCODE_API_KEY",
    opencode: "OPENCODE_API_KEY",
    ollama: "OLLAMA_BASE_URL",
  };
  
  const envKey = envKeyMap[provider];
  
  if (provider === "ollama") {
    const ollamaUrl = await p.text({
      message: "Ollama Base URL:",
      initialValue: "http://localhost:11434",
      placeholder: "http://localhost:11434",
    });
    
    if (p.isCancel(ollamaUrl)) {
      p.cancel("Onboarding cancelled.");
      process.exit(0);
    }
    
    config[envKey] = ollamaUrl;
  } else {
    const apiKey = await p.password({
      message: `Enter your ${envKey} (leave blank to skip):`,
      mask: "●",
    });
    
    if (p.isCancel(apiKey)) {
      p.cancel("Onboarding cancelled.");
      process.exit(0);
    }
    
    if (apiKey) {
      config[envKey] = apiKey;
    }
  }
  
  // Step 6: Select Model
  if (config[envKey] || provider === "ollama") {
    const s = p.spinner();
    s.start("Fetching available models...");
    
    try {
      const models = await getModels(provider, config[envKey]);
      s.stop(pc.green(`Found ${models.length} models`));
      
      if (models.length > 0) {
        const model = await p.select({
          message: "Select a model:",
          options: models.map(m => ({
            value: m,
            label: m,
          })),
        });
        
        if (!p.isCancel(model)) {
          config["KRAB_DEFAULT_MODEL"] = model;
        }
      }
    } catch (error) {
      s.stop(pc.yellow("Could not fetch models, using defaults"));
    }
  }
  
  // Step 7: Additional Settings
  p.log.step("Additional Settings");
  
  const enableVoice = await p.confirm({
    message: "Enable voice features (STT/TTS)?",
    initialValue: true,
  });
  
  if (!p.isCancel(enableVoice)) {
    config["KRAB_ENABLE_VOICE"] = enableVoice ? "true" : "false";
  }
  
  const enableMemory = await p.confirm({
    message: "Enable long-term memory?",
    initialValue: true,
  });
  
  if (!p.isCancel(enableMemory)) {
    config["KRAB_ENABLE_LONG_TERM_MEMORY"] = enableMemory ? "true" : "false";
  }
  
  // Step 8: Save Configuration
  const s = p.spinner();
  s.start("Saving configuration...");
  
  // Read existing .env if exists
  let envContent = "";
  if (existsSync(ENV_PATH)) {
    envContent = readFileSync(ENV_PATH, "utf-8") + "\n\n";
  }
  
  // Add new config
  envContent += "# 🦀 Krab Configuration (Generated by onboarding)\n";
  envContent += `# Date: ${new Date().toISOString()}\n\n`;
  
  for (const [key, value] of Object.entries(config)) {
    if (value) {
      envContent += `${key}=${value}\n`;
    }
  }
  
  writeFileSync(ENV_PATH, envContent);
  
  // Create .krab directory structure
  if (!existsSync(KRAB_DIR)) {
    mkdirSync(KRAB_DIR, { recursive: true });
  }
  
  s.stop(pc.green("Configuration saved!"));
  
  // Completion
  p.outro([
    pc.bgGreen(pc.black(" ✓ Onboarding Complete! ")),
    "",
    pc.bold("What's next?"),
    "",
    `  ${pc.cyan("krab chat")}     Start interactive chat`,
    `  ${pc.cyan("krab tui")}      Launch modern TUI`,
    `  ${pc.cyan("krab ask")}      Ask a single question`,
    `  ${pc.cyan("krab --help")}   Show all commands`,
    "",
    pc.dim(`Configuration saved to: ${ENV_PATH}`),
  ].join("\n"));
}
