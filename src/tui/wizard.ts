// ============================================================
// 🦀 Krab — Wizard Setup TUI (Interactive Onboarding)
// ============================================================
import * as p from "@clack/prompts";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { getModels } from "../utils/model-fetcher.js";
import { loadConfig } from "../core/config.js";
import { Agent } from "../core/agent.js";

const ENV_PATH = resolve(process.cwd(), ".env");

// Translation system
const translations = {
  th: {
    intro: " 🦀 Krab Wizard  — Setup your AI agent",
    existingConfig: "พบการตั้งค่าเดิม คุณต้องการทำอะไร?",
    keepConfig: "✅ ใช้การตั้งค่าเดิม",
    keepConfigHint: "ข้าม wizard",
    modifyConfig: "✏️ แก้ไขการตั้งค่า",
    modifyConfigHint: "เลือก provider ใหม่",
    resetConfig: "🗑️ รีเซ็ตทั้งหมด",
    resetConfigHint: "ลบ .env และเริ่มใหม่",
    confirmReset: "แน่ใจหรือไม่ว่าต้องการลบการตั้งค่าทั้งหมด?",
    resetSuccess: "✓ รีเซ็ตสำเร็จ — เริ่มต้นใหม่",
    selectProvider: "เลือก LLM Provider (โมเดล AI ที่ต้องการใช้):",
    ollamaUrl: "Ollama Base URL:",
    ollamaUrlPlaceholder: "http://localhost:11434",
    enterApiKey: (envKey: string) => `ใส่ ${envKey}:`,
    fetchingModels: "กำลังดึงรายการโมเดล...",
    modelsFound: (count: number) => `พบ ${count} โมเดล`,
    staticModels: "ใช้รายการโมเดลเริ่มต้น",
    noModelsFound: "❌ ไม่พบโมเดลสำหรับ provider นี้",
    selectModel: "เลือกโมเดล:",
    savingConfig: "กำลังบันทึกการตั้งค่า...",
    saveSuccess: "บันทึกสำเร็จ!",
    configComplete: "การตั้งค่าเสร็จสมบูรณ์",
    readyToUse: " ✓ พร้อมใช้งาน! ",
    usageInstructions: "ลองใช้คำสั่ง:",
    chatCommand: "  npm run dev -- chat    # คุยกับ AI แบบ interactive",
    askCommand: "  npm run dev -- ask \"คำถาม\"  # ถามคำถามเดียว",
    wizardCommand: "  npm run dev -- wizard  # รัน wizard อีกครั้ง",
    cancelSetup: "ยกเลิกการตั้งค่า",
    languageSelection: "Choose your language / เลือกภาษา:",
    thaiLanguage: "🇹🇭 ไทย (Thai)",
    englishLanguage: "🇺🇸 English",
  },
  en: {
    intro: " 🦀 Krab Wizard — Setup your AI agent",
    existingConfig: "Found existing configuration. What would you like to do?",
    keepConfig: "✅ Keep existing configuration",
    keepConfigHint: "Skip wizard",
    modifyConfig: "✏️ Modify configuration",
    modifyConfigHint: "Select new provider",
    resetConfig: "🗑️ Reset everything",
    resetConfigHint: "Delete .env and start over",
    confirmReset: "Are you sure you want to delete all configuration?",
    resetSuccess: "✓ Reset successful — Starting fresh",
    selectProvider: "Select LLM Provider (AI model to use):",
    ollamaUrl: "Ollama Base URL:",
    ollamaUrlPlaceholder: "http://localhost:11434",
    enterApiKey: (envKey: string) => `Enter ${envKey}:`,
    fetchingModels: "Fetching model list...",
    modelsFound: (count: number) => `Found ${count} models`,
    staticModels: "Using default model list",
    noModelsFound: "❌ No models found for this provider",
    selectModel: "Select model:",
    savingConfig: "Saving configuration...",
    saveSuccess: "Save successful!",
    configComplete: "Configuration completed",
    readyToUse: " ✓ Ready to use! ",
    usageInstructions: "Try these commands:",
    chatCommand: "  npm run dev -- chat    # Interactive chat with AI",
    askCommand: "  npm run dev -- ask \"question\"  # Ask a single question",
    wizardCommand: "  npm run dev -- wizard  # Run wizard again",
    cancelSetup: "Cancel setup",
    languageSelection: "Choose your language / Select language:",
    thaiLanguage: "🇹🇭 Thai",
    englishLanguage: "🇺🇸 English",
  },
};

// Current language (default to th)
let currentLang: "th" | "en" = "th";

function getText(key: keyof typeof translations.th, ...args: any[]): string {
  const text = translations[currentLang][key];
  if (typeof text === "function") {
    return (text as Function)(...args);
  }
  return text as string;
}

// Provider definitions (models will be fetched dynamically)
const PROVIDERS = [
  {
    value: "google",
    label: "Google Gemini",
    hint: "ฟรี tier มีให้ — แนะนำสำหรับเริ่มต้น",
    emoji: "🌍",
    envKey: "GEMINI_API_KEY",
    supportsDynamicFetch: false, // Static only
  },
  {
    value: "openai",
    label: "OpenAI",
    hint: "ต้องมี API Key (ไม่ฟรี)",
    emoji: "🤖",
    envKey: "OPENAI_API_KEY",
    supportsDynamicFetch: true,
  },
  {
    value: "anthropic",
    label: "Anthropic Claude",
    hint: "ต้องมี API Key (ไม่ฟรี)",
    emoji: "🧠",
    envKey: "ANTHROPIC_API_KEY",
    supportsDynamicFetch: false, // Static only
  },
  {
    value: "opencode",
    label: "OpenCode Zen",
    hint: "มีโมเดลฟรี: big-pickle, minimax-m2.5-free",
    emoji: "⚡",
    envKey: "OPENCODE_API_KEY",
    supportsDynamicFetch: false, // Static only
  },
  {
    value: "kilocode",
    label: "KiloCode",
    hint: "มีโมเดลฟรี: stepfun/step-3.5-flash:free",
    emoji: "🚀",
    envKey: "KILOCODE_API_KEY",
    supportsDynamicFetch: false, // Static only
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    hint: "โมเดลฟรีเยอะมาก — ดึงรายการอัตโนมัติ",
    emoji: "🌐",
    envKey: "OPENROUTER_API_KEY",
    supportsDynamicFetch: true, // Fetches from API
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    hint: "ราคาถูก คุณภาพดี",
    emoji: "💰",
    envKey: "DEEPSEEK_API_KEY",
    supportsDynamicFetch: false, // Static only
  },
  {
    value: "ollama",
    label: "Ollama (Local)",
    hint: "ฟรี 100% — รันบนเครื่องคุณเอง",
    emoji: "🏠",
    envKey: "OLLAMA_BASE_URL",
    supportsDynamicFetch: false, // Static only
  },
];

export async function runWizard() {
  console.clear();
  
  // Step 0: Select Language
  const language = await p.select({
    message: getText("languageSelection"),
    options: [
      { value: "th", label: getText("thaiLanguage") },
      { value: "en", label: getText("englishLanguage") },
    ],
  });
  
  if (p.isCancel(language)) {
    p.outro(getText("cancelSetup"));
    return;
  }
  
  currentLang = language as "th" | "en";
  
  p.intro(getText("intro"));
  
  // Check existing config
  const hasEnv = existsSync(ENV_PATH);
  let existingEnv: Record<string, string> = {};
  
  if (hasEnv) {
    dotenvConfig({ path: ENV_PATH });
    existingEnv = Object.fromEntries(
      Object.entries(process.env)
        .filter(([k, v]) => v !== undefined && PROVIDERS.some(p => p.envKey === k || k === "KRAB_DEFAULT_MODEL"))
        .map(([k, v]) => [k, v as string])
    );
  }
  
  const hasExistingConfig = Object.keys(existingEnv).length > 0;
  
  // Step 1: Detect existing config
  if (hasExistingConfig) {
    const action = await p.select({
      message: getText("existingConfig"),
      options: [
        { value: "keep", label: getText("keepConfig"), hint: getText("keepConfigHint") },
        { value: "modify", label: getText("modifyConfig"), hint: getText("modifyConfigHint") },
        { value: "reset", label: getText("resetConfig"), hint: getText("resetConfigHint") },
      ],
    });
    
    if (p.isCancel(action)) {
      p.outro(getText("cancelSetup"));
      return;
    }
    
    if (action === "keep") {
      p.outro(`${getText("keepConfig").split(" ")[0]} ใช้การตั้งค่าเดิม — พร้อมใช้งาน!`);
      return;
    }
    
    if (action === "reset") {
      const confirm = await p.confirm({
        message: getText("confirmReset"),
        initialValue: false,
      });
      if (confirm) {
        // Clear env content but keep file
        writeFileSync(ENV_PATH, "# Krab Configuration\n\n");
        p.outro(getText("resetSuccess"));
      }
    }
  }
  
  // Step 2: Select Provider
  const provider = await p.select({
    message: getText("selectProvider"),
    options: PROVIDERS.map(p => ({
      value: p.value,
      label: `${p.emoji} ${p.label}`,
      hint: p.hint,
    })),
  });
  
  if (p.isCancel(provider)) {
    p.outro(getText("cancelSetup"));
    return;
  }
  
  const providerInfo = PROVIDERS.find(p => p.value === provider)!;
  
  // Step 3: Enter API Key
  let apiKey = "";
  
  if (provider === "ollama") {
    // Ollama uses base URL instead of API key
    const baseUrl = await p.text({
      message: getText("ollamaUrl"),
      initialValue: getText("ollamaUrlPlaceholder"),
      placeholder: getText("ollamaUrlPlaceholder"),
    });
    
    if (p.isCancel(baseUrl)) {
      p.outro(getText("cancelSetup"));
      return;
    }
    
    apiKey = baseUrl as string;
  } else {
    // Check if env already has key
    const existingKey = process.env[providerInfo.envKey];
    
    if (existingKey) {
      const useExisting = await p.confirm({
        message: `พบ ${providerInfo.envKey} ใน environment ใช้ค่านี้หรือไม่?`,
        initialValue: true,
      });
      
      if (useExisting) {
        apiKey = existingKey;
      }
    }
    
    if (!apiKey) {
      const key = await p.password({
        message: getText("enterApiKey", providerInfo.envKey),
        mask: "*",
      });
      
      if (p.isCancel(key)) {
        p.outro(getText("cancelSetup"));
        return;
      }
      
      apiKey = key as string;
    }
  }
  
  // Step 4: Select Model
  const s = p.spinner();
  s.start(getText("fetchingModels"));
  
  let models: string[] = [];
  try {
    models = await getModels(provider as string, apiKey);
  } catch {
    // Fallback to static list
    models = [];
  }
  
  s.stop(models.length > 0 ? getText("modelsFound", models.length) : getText("staticModels"));
  
  if (models.length === 0) {
    p.outro(getText("noModelsFound"));
    return;
  }
  
  const model = await p.select({
    message: getText("selectModel"),
    options: models.map((m: string) => ({
      value: m,
      label: m,
    })),
  });
  
  if (p.isCancel(model)) {
    p.outro(getText("cancelSetup"));
    return;
  }
  
  // Step 5: Save configuration
  const saveSpinner = p.spinner();
  saveSpinner.start(getText("savingConfig"));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Build env content
  let envContent = "# 🦀 Krab Configuration\n\n";
  envContent += `# === LLM Provider ===\n`;
  envContent += `${providerInfo.envKey}=${apiKey}\n\n`;
  envContent += `# Default model\n`;
  envContent += `KRAB_DEFAULT_MODEL=${provider}/${model}\n\n`;
  envContent += `# Language preference\n`;
  envContent += `KRAB_LANGUAGE=${currentLang}\n\n`;
  envContent += `# === Optional Settings ===\n`;
  envContent += `# KRAB_DEBUG=true\n`;
  envContent += `# KRAB_MAX_ITERATIONS=10\n`;
  
  // Preserve other existing env vars
  if (hasEnv) {
    const existing = readFileSync(ENV_PATH, "utf-8");
    const lines = existing.split("\n");
    for (const line of lines) {
      // Skip comments and empty lines, and keys we're setting
      if (line.startsWith("#") || !line.includes("=")) continue;
      const [key] = line.split("=");
      if (key && key !== providerInfo.envKey && key !== "KRAB_DEFAULT_MODEL" && key !== "KRAB_LANGUAGE") {
        envContent += `${line}\n`;
      }
    }
  }
  
  writeFileSync(ENV_PATH, envContent);
  
  saveSpinner.stop(getText("saveSuccess"));
  
  // Success message
  p.note(
    `Provider: ${providerInfo.label}\n` +
    `Model: ${model}\n` +
    `Language: ${currentLang === "th" ? "ไทย" : "English"}\n` +
    `Config saved to: ${ENV_PATH}`,
    getText("configComplete")
  );
  
  p.outro(getText("readyToUse"));
  console.log("\n" + getText("usageInstructions"));
  console.log(getText("chatCommand"));
  console.log(getText("askCommand"));
  console.log(getText("wizardCommand") + "\n");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWizard().catch(console.error);
}
