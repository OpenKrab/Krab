import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { getModels } from "../utils/model-fetcher.js";
import { getConfigPath, getEnvPath, saveConfig } from "../core/krab-config.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const I18N_PATH = resolve(__dirname, "..", "tui", "i18n.json");

function loadI18n() {
  try {
    return JSON.parse(readFileSync(I18N_PATH, "utf-8"));
  } catch (error) {
    return { onboarding: {} };
  }
}

const i18n = loadI18n().onboarding;

// Generate random token
function generateToken(): string {
  return "krab_" + randomBytes(32).toString("hex");
}

export async function runOnboarding() {
  console.clear();

  // Header
  p.intro(pc.bgCyan(pc.black(i18n.intro)));

  // Step 1: Security Warning
  p.log.message(pc.yellow(`${i18n.security_warning_title}\n`));
  p.log.message(i18n.security_warning_body);

  const securityAck = await p.confirm({
    message: i18n.security_confirm,
    initialValue: true,
  });

  if (!securityAck || p.isCancel(securityAck)) {
    p.cancel(i18n.cancel_msg);
    process.exit(0);
  }

  // Step 2: Config Detection
  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    p.log.message(pc.blue(`\n📢 ${i18n.config_handler_msg}`));
    const configAction = await p.select({
      message: "Action:",
      options: [
        { value: "keep", label: i18n.config_keep },
        { value: "modify", label: i18n.config_modify },
        { value: "reset", label: i18n.config_reset },
      ],
    });

    if (p.isCancel(configAction)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    if (configAction === "keep") {
      p.outro(i18n.config_saved);
      return;
    }

    if (configAction === "reset") {
      // Logic for reset could be adding a flag to start fresh
    }
  }

  // Step 3: Select Setup Type
  const setupType = await p.select({
    message: i18n.setup_type_msg,
    options: [
      {
        value: "local",
        label: i18n.setup_local_label,
        hint: i18n.setup_local_hint,
      },
      {
        value: "gateway",
        label: i18n.setup_gateway_label,
        hint: i18n.setup_gateway_hint,
      },
      {
        value: "minimal",
        label: i18n.setup_minimal_label,
        hint: i18n.setup_minimal_hint,
      },
    ],
  });

  if (p.isCancel(setupType)) {
    p.cancel(i18n.cancel_msg);
    process.exit(0);
  }

  const envValues: Record<string, string> = {};
  const configValues: any = {};

  // Step 4: Core Configuration
  if (setupType !== "minimal") {
    const workspace = await p.text({
      message: i18n.workspace_msg,
      initialValue: join(homedir(), ".krab", "workspace"),
      placeholder: join(homedir(), ".krab", "workspace"),
    });

    if (p.isCancel(workspace)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }
    configValues.agents = {
      defaults: {
        workspace: workspace,
      },
    };
  }

  // Step 5: Gateway Configuration
  if (setupType === "gateway") {
    p.log.step("Gateway Configuration");

    const port = await p.text({
      message: i18n.port_msg,
      initialValue: "18789",
      placeholder: "18789",
      validate: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1024 || num > 65535) {
          return i18n.port_invalid;
        }
      },
    });

    if (p.isCancel(port)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    const bind = await p.select({
      message: i18n.bind_msg,
      options: [
        { value: "loopback", label: i18n.bind_loopback },
        { value: "lan", label: i18n.bind_all },
      ],
      initialValue: "loopback",
    });

    if (p.isCancel(bind)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    const auth = await p.select({
      message: i18n.auth_msg,
      options: [
        { value: "token", label: i18n.auth_token },
        { value: "none", label: i18n.auth_none },
      ],
      initialValue: "token",
    });

    if (p.isCancel(auth)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    let token = "";
    if (auth === "token") {
      const tokenInput = await p.text({
        message: i18n.token_msg,
        placeholder: i18n.token_hint,
      });

      if (p.isCancel(tokenInput)) {
        p.cancel(i18n.cancel_msg);
        process.exit(0);
      }
      token = tokenInput || generateToken();

      if (!tokenInput) {
        p.log.success(
          i18n.token_generated.replace(
            "{token}",
            `${token.substring(0, 20)}...`,
          ),
        );
      }
    }

    configValues.gateway = {
      port: parseInt(port),
      bind: bind,
      auth: {
        mode: auth,
        token: token,
      },
    };
  }

  // Step 6: LLM Provider Setup
  p.log.step(i18n.provider_msg);

  const provider = await p.select({
    message: i18n.provider_msg,
    options: [
      {
        value: "google",
        label: "🌍 Google Gemini",
        hint: "Free tier available",
      },
      { value: "openai", label: "🤖 OpenAI", hint: "GPT-4, GPT-3.5" },
      {
        value: "anthropic",
        label: "🧠 Anthropic Claude",
        hint: "Claude models",
      },
      {
        value: "openrouter",
        label: "🌐 OpenRouter",
        hint: "Free models available",
      },
      { value: "kilocode", label: "🚀 KiloCode", hint: "Experimental" },
      { value: "ollama", label: "💻 Ollama", hint: "Run models locally" },
    ],
  });

  if (p.isCancel(provider)) {
    p.cancel(i18n.cancel_msg);
    process.exit(0);
  }

  const envKeyMap: Record<string, string> = {
    openrouter: "OPENROUTER_API_KEY",
    google: "GEMINI_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    kilocode: "KILOCODE_API_KEY",
    ollama: "OLLAMA_BASE_URL",
  };

  const envKey = envKeyMap[provider];
  let apiKey = "";

  if (provider === "ollama") {
    const ollamaUrl = await p.text({
      message: "Ollama Base URL:",
      initialValue: "http://localhost:11434",
      placeholder: "http://localhost:11434",
    });

    if (p.isCancel(ollamaUrl)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    envValues[envKey] = ollamaUrl;
  } else {
    const keyInput = await p.password({
      message: i18n.api_key_msg.replace("{key}", envKey),
      mask: "●",
    });

    if (p.isCancel(keyInput)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    if (keyInput) {
      envValues[envKey] = keyInput;
      apiKey = keyInput;
    }
  }

  // Step 7: Select Model
  if (apiKey || provider === "ollama") {
    const s = p.spinner();
    s.start(i18n.fetching_models);

    try {
      const models = await getModels(
        provider as any,
        apiKey || envValues[envKey],
      );
      s.stop(i18n.models_found.replace("{count}", models.length.toString()));

      if (models.length > 0) {
        const model = await p.select({
          message: i18n.model_select_msg,
          options: models.map((m) => ({
            value: m,
            label: m,
          })),
        });

        if (!p.isCancel(model)) {
          if (!configValues.agents) configValues.agents = { defaults: {} };
          if (!configValues.agents.defaults.model)
            configValues.agents.defaults.model = {};
          configValues.agents.defaults.model.primary = model;
          envValues["KRAB_DEFAULT_MODEL"] = model;
        }
      }
    } catch (error) {
      s.stop(i18n.models_not_found);
    }
  }

  // Step 8: Save & Finish
  const s = p.spinner();
  s.start(i18n.saving_config);

  // Save .env
  const envPath = getEnvPath();
  let envContent = "";
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, "utf-8") + "\n\n";
  }
  envContent += `# 🦀 Krab Config - ${new Date().toISOString()}\n`;
  for (const [k, v] of Object.entries(envValues)) {
    envContent += `${k}=${v}\n`;
  }
  writeFileSync(envPath, envContent);

  // Save krab.json
  saveConfig(configValues);

  // Create workspace if needed
  if (configValues.agents?.defaults?.workspace) {
    const ws = resolve(configValues.agents.defaults.workspace);
    if (!existsSync(ws)) {
      mkdirSync(ws, { recursive: true });
    }
  }

  s.stop(i18n.config_saved);

  // Completion
  p.outro(
    [
      pc.bgGreen(pc.black(i18n.complete_title)),
      "",
      pc.bold(i18n.next_steps_title),
      "",
      `  ${pc.cyan("krab chat")}     ${i18n.next_chat}`,
      `  ${pc.cyan("krab tui")}      ${i18n.next_tui}`,
      `  ${pc.cyan("krab ask")}      ${i18n.next_ask}`,
      `  ${pc.cyan("krab --help")}   ${i18n.next_help}`,
      "",
      pc.dim(i18n.saved_to.replace("{path}", configPath)),
    ].join("\n"),
  );
}
