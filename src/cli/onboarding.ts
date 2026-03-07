import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { getModels } from "../utils/model-fetcher.js";
import { getConfigPath, getEnvPath, saveConfig } from "../core/krab-config.js";
import { checkAndRunBootstrap } from "../bootstrap/index.js";

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

function t(key: string, fallback: string): string {
  const value = i18n?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

// Generate random token
function generateToken(): string {
  return "krab_" + randomBytes(32).toString("hex");
}

export type OnboardingOptions = {
  mode?: "local" | "remote";
  flow?: "quickstart" | "advanced";
  workspace?: string;
  nonInteractive?: boolean;
  acceptRisk?: boolean;
  gatewayPort?: number;
  gatewayBind?: "loopback" | "lan";
  gatewayAuth?: "token" | "none";
  gatewayToken?: string;
  remoteUrl?: string;
  remoteToken?: string;
  provider?: "google" | "openai" | "anthropic" | "openrouter" | "kilocode" | "ollama";
  model?: string;
  apiKey?: string;
  channels?: string[];
  skipChannels?: boolean;
  skipSkills?: boolean;
  skipHealth?: boolean;
  skipBootstrap?: boolean;
  installDaemon?: boolean;
};

const PROVIDER_ENV_KEY: Record<string, string> = {
  openrouter: "OPENROUTER_API_KEY",
  google: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  kilocode: "KILOCODE_API_KEY",
  ollama: "OLLAMA_BASE_URL",
};

function writeEnvAndConfig(envValues: Record<string, string>, configValues: any) {
  const configPath = getConfigPath();
  const envPath = getEnvPath();
  const envDir = dirname(envPath);
  if (!existsSync(envDir)) {
    mkdirSync(envDir, { recursive: true });
  }

  let envContent = "";
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, "utf-8") + "\n\n";
  }
  envContent += `# 🦀 Krab Config - ${new Date().toISOString()}\n`;
  for (const [k, v] of Object.entries(envValues)) {
    envContent += `${k}=${v}\n`;
  }
  writeFileSync(envPath, envContent);

  saveConfig(configValues);

  if (configValues.agents?.defaults?.workspace) {
    const ws = resolve(configValues.agents.defaults.workspace);
    if (!existsSync(ws)) {
      mkdirSync(ws, { recursive: true });
    }
  }

  return { configPath, envPath };
}

async function runNonInteractiveOnboarding(opts: OnboardingOptions): Promise<void> {
  if (opts.acceptRisk !== true) {
    console.error(pc.red("Non-interactive onboarding requires --accept-risk"));
    process.exit(1);
  }

  const mode = opts.mode || "local";
  const flow = opts.flow || "quickstart";
  if (mode !== "local" && mode !== "remote") {
    console.error(pc.red(`Invalid --mode: ${mode} (use local|remote)`));
    process.exit(1);
  }
  if (flow !== "quickstart" && flow !== "advanced") {
    console.error(pc.red(`Invalid --flow: ${flow} (use quickstart|advanced)`));
    process.exit(1);
  }
  const workspace = opts.workspace || join(homedir(), ".krab", "workspace");
  const provider = opts.provider || "kilocode";
  const selectedChannels = opts.channels || [];

  const envValues: Record<string, string> = {};
  const configValues: any = {
    agents: { defaults: { workspace } },
  };

  if (mode === "remote") {
    configValues.gateway = {
      mode: "remote",
      remoteUrl: opts.remoteUrl || "ws://127.0.0.1:18789",
      auth: {
        mode: opts.remoteToken ? "token" : "none",
        token: opts.remoteToken || "",
      },
    };
  } else {
    const auth = opts.gatewayAuth || "token";
    const token = auth === "token" ? opts.gatewayToken || generateToken() : "";
    configValues.gateway = {
      mode: "local",
      port: opts.gatewayPort || 18789,
      bind: opts.gatewayBind || "loopback",
      auth: {
        mode: auth,
        token,
        allowTailscale: false,
      },
    };
    if (flow === "quickstart") {
      configValues.tools = { profile: "messaging" };
      configValues.session = { dmScope: "per-channel-peer" };
    }

    if (!opts.skipChannels && selectedChannels.length > 0) {
      configValues.channels = configValues.channels || {};
      for (const channel of selectedChannels) {
        configValues.channels[channel] = {
          enabled: true,
          dmPolicy: "allowlist",
          groupPolicy: "open",
        };
      }
    }

    if (opts.installDaemon) {
      configValues.daemon = {
        enabled: true,
        autostart: true,
      };
    }

    if (!opts.skipSkills) {
      configValues.skills = {
        recommended: true,
      };
    }
  }

  const providerKey = PROVIDER_ENV_KEY[provider];
  if (provider === "ollama") {
    envValues[providerKey] = opts.apiKey || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  } else if (opts.apiKey) {
    envValues[providerKey] = opts.apiKey;
  }

  if (opts.model) {
    envValues.KRAB_DEFAULT_MODEL = opts.model;
    configValues.agents.defaults.model = { primary: opts.model };
  }

  const paths = writeEnvAndConfig(envValues, configValues);

  let healthCheckResult = "skipped";
  if (!opts.skipHealth) {
    try {
      if (mode === "remote") {
        const remoteWs = configValues.gateway?.remoteUrl || "ws://127.0.0.1:18789";
        const healthUrl = String(remoteWs).replace(/^ws/, "http") + "/healthz";
        const res = await fetch(healthUrl);
        healthCheckResult = res.ok ? "ok" : `http-${res.status}`;
      } else {
        const res = await fetch("http://127.0.0.1:18789/healthz");
        healthCheckResult = res.ok ? "ok" : `http-${res.status}`;
      }
    } catch {
      healthCheckResult = "unreachable";
    }
  }

  console.log(pc.green("✓ Non-interactive onboarding complete"));
  console.log(pc.dim(`Mode: ${mode}`));
  console.log(pc.dim(`Flow: ${flow}`));
  console.log(pc.dim(`Channels: ${opts.skipChannels ? "skipped" : selectedChannels.length}`));
  console.log(pc.dim(`Daemon: ${opts.installDaemon ? "enabled" : "not-enabled"}`));
  console.log(pc.dim(`Health check: ${opts.skipHealth ? "skipped" : healthCheckResult}`));
  console.log(pc.dim(`Bootstrap: ${opts.skipBootstrap ? "skipped" : "run"}`));
  console.log(pc.dim(`Skills: ${opts.skipSkills ? "skipped" : "recommended"}`));
  console.log(pc.dim(`Config: ${paths.configPath}`));
  console.log(pc.dim(`Env: ${paths.envPath}`));
}

export async function runOnboarding(opts: OnboardingOptions = {}) {
  if (opts.nonInteractive) {
    await runNonInteractiveOnboarding(opts);
    return;
  }

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

  // Step 3: Wizard Profile (OpenClaw-style)
  const wizardMode = await p.select({
    message: "Choose onboarding mode:",
    options: [
      {
        value: "quickstart",
        label: "⚡ QuickStart (Recommended)",
        hint: "Secure local defaults, fastest path",
      },
      {
        value: "advanced",
        label: "🛠️  Advanced",
        hint: "Full control over mode, gateway, and policies",
      },
    ],
    initialValue: "quickstart",
  });

  if (p.isCancel(wizardMode)) {
    p.cancel(i18n.cancel_msg);
    process.exit(0);
  }

  let setupType: "local" | "gateway" | "minimal" | "remote" = "gateway";
  let generatedGatewayToken = "";

  if (wizardMode === "advanced") {
    const selected = await p.select({
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
          value: "remote",
          label: "🌉 Remote Gateway Client",
          hint: "Connect this CLI to a remote Gateway",
        },
        {
          value: "minimal",
          label: i18n.setup_minimal_label,
          hint: i18n.setup_minimal_hint,
        },
      ],
    });

    if (p.isCancel(selected)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    setupType = selected as "local" | "gateway" | "minimal" | "remote";
  } else {
    // QuickStart defaults, modeled after OpenClaw onboarding docs.
    setupType = "gateway";
    generatedGatewayToken = generateToken();
  }

  const envValues: Record<string, string> = {};
  const configValues: any = {};

  // Step 4: Core Configuration
  if (setupType !== "minimal") {
    const defaultWorkspace = join(homedir(), ".krab", "workspace");
    const workspace = await p.text({
      message: i18n.workspace_msg,
      initialValue: defaultWorkspace,
      placeholder: defaultWorkspace,
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

    if (wizardMode === "quickstart") {
      configValues.gateway = {
        mode: "local",
        port: 18789,
        bind: "loopback",
        auth: {
          mode: "token",
          token: generatedGatewayToken,
          allowTailscale: false,
        },
      };
      configValues.tools = {
        ...(configValues.tools || {}),
        profile: "messaging",
      };
      configValues.session = {
        ...(configValues.session || {}),
        dmScope: "per-channel-peer",
      };
      p.log.success(
        `QuickStart defaults applied (port 18789, loopback, token auth, tools.profile=messaging)`,
      );
      p.log.message(
        pc.dim(
          `Gateway token: ${generatedGatewayToken.substring(0, 20)}... (saved to config)`,
        ),
      );
    } else {
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
        mode: "local",
        port: parseInt(port),
        bind: bind,
        auth: {
          mode: auth,
          token: token,
        },
      };
    }
  }

  if (setupType === "remote") {
    p.log.step("Remote Gateway Configuration");
    const remoteUrl = await p.text({
      message: "Remote gateway URL:",
      initialValue: "ws://127.0.0.1:18789",
      placeholder: "wss://gateway.example.com",
    });

    if (p.isCancel(remoteUrl)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    const remoteToken = await p.password({
      message: "Remote gateway token (optional):",
      mask: "●",
    });

    if (p.isCancel(remoteToken)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    configValues.gateway = {
      mode: "remote",
      remoteUrl,
      auth: {
        mode: remoteToken ? "token" : "none",
        token: remoteToken || "",
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

  // Step 8: Channels
  let enabledChannels: string[] = [];
  if (setupType !== "minimal" && setupType !== "remote") {
    p.log.step("Channels");
    const configureChannels = await p.confirm({
      message: "Configure channels now?",
      initialValue: wizardMode === "quickstart",
    });

    if (p.isCancel(configureChannels)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    if (configureChannels) {
      const pickedChannels = await p.multiselect({
        message: "Select channels to enable:",
        options: [
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "discord", label: "Discord" },
          { value: "line", label: "LINE" },
          { value: "signal", label: "Signal" },
          { value: "imessage", label: "iMessage" },
        ],
      });

      if (p.isCancel(pickedChannels)) {
        p.cancel(i18n.cancel_msg);
        process.exit(0);
      }

      enabledChannels = (pickedChannels || []) as string[];
      if (enabledChannels.length > 0) {
        configValues.channels = configValues.channels || {};
      }

      for (const channel of enabledChannels) {
        configValues.channels[channel] = {
          enabled: true,
          dmPolicy: "allowlist",
          groupPolicy: "open",
        };

        if (channel === "telegram") {
          const token = await p.password({
            message: "TELEGRAM_BOT_TOKEN (optional):",
            mask: "●",
          });
          if (p.isCancel(token)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (token) envValues.TELEGRAM_BOT_TOKEN = token;
        }

        if (channel === "whatsapp") {
          const accessToken = await p.password({
            message: "WHATSAPP_ACCESS_TOKEN (optional):",
            mask: "●",
          });
          if (p.isCancel(accessToken)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (accessToken) envValues.WHATSAPP_ACCESS_TOKEN = accessToken;

          const phoneId = await p.text({
            message: "WHATSAPP_PHONE_NUMBER_ID (optional):",
            placeholder: "1234567890",
          });
          if (p.isCancel(phoneId)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (phoneId) envValues.WHATSAPP_PHONE_NUMBER_ID = phoneId;
        }

        if (channel === "discord") {
          const token = await p.password({
            message: "DISCORD_BOT_TOKEN (optional):",
            mask: "●",
          });
          if (p.isCancel(token)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (token) envValues.DISCORD_BOT_TOKEN = token;
        }

        if (channel === "line") {
          const accessToken = await p.password({
            message: "LINE_CHANNEL_ACCESS_TOKEN (optional):",
            mask: "●",
          });
          if (p.isCancel(accessToken)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (accessToken) envValues.LINE_CHANNEL_ACCESS_TOKEN = accessToken;

          const secret = await p.password({
            message: "LINE_CHANNEL_SECRET (optional):",
            mask: "●",
          });
          if (p.isCancel(secret)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (secret) envValues.LINE_CHANNEL_SECRET = secret;
        }

        if (channel === "signal") {
          const signalToken = await p.password({
            message: "SIGNAL_API_TOKEN (optional):",
            mask: "●",
          });
          if (p.isCancel(signalToken)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (signalToken) envValues.SIGNAL_API_TOKEN = signalToken;
        }

        if (channel === "imessage") {
          const apiUrl = await p.text({
            message: "IMESSAGE_API_URL (optional):",
            placeholder: "http://localhost:1234",
          });
          if (p.isCancel(apiUrl)) {
            p.cancel(i18n.cancel_msg);
            process.exit(0);
          }
          if (apiUrl) envValues.IMESSAGE_API_URL = apiUrl;
        }
      }
    }
  }

  // Step 9: Daemon
  let daemonEnabled = false;
  if (setupType !== "minimal" && setupType !== "remote") {
    p.log.step("Daemon");
    const installDaemon = await p.confirm({
      message: "Enable daemon mode for background gateway service?",
      initialValue: false,
    });

    if (p.isCancel(installDaemon)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    daemonEnabled = Boolean(installDaemon);
    if (daemonEnabled) {
      configValues.daemon = {
        enabled: true,
        autostart: true,
      };
      p.log.message(pc.dim("Daemon will be available via: krab daemon start"));
    }
  }

  // Step 10: Health Check
  let healthCheckRan = false;
  if (setupType !== "minimal") {
    p.log.step("Health Check");
    const runHealth = await p.confirm({
      message: "Run quick health check now?",
      initialValue: true,
    });

    if (p.isCancel(runHealth)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    if (runHealth) {
      healthCheckRan = true;
      try {
        const healthUrl = setupType === "remote"
          ? `${(configValues.gateway?.remoteUrl || "ws://127.0.0.1:18789").replace(/^ws/, "http")}/healthz`
          : "http://127.0.0.1:18789/healthz";
        const response = await fetch(healthUrl);
        if (response.ok) {
          p.log.success("Gateway health check: OK");
        } else {
          p.log.warn(`Gateway health check returned status ${response.status}`);
        }
      } catch {
        p.log.warn("Gateway health endpoint not reachable yet (start gateway after onboarding)");
      }
    }
  }

  // Step 11: Skills
  let skillsRecommended = false;
  if (setupType !== "minimal") {
    p.log.step("Skills");
    const installSkills = await p.confirm({
      message: "Enable recommended skills profile?",
      initialValue: true,
    });

    if (p.isCancel(installSkills)) {
      p.cancel(i18n.cancel_msg);
      process.exit(0);
    }

    skillsRecommended = Boolean(installSkills);
    if (skillsRecommended) {
      configValues.skills = {
        ...(configValues.skills || {}),
        recommended: true,
      };
      p.log.message(pc.dim("Tip: run 'krab skills list' to inspect available skills"));
    }
  }

  // Step 12: Save & Finish
  const s = p.spinner();
  s.start(i18n.saving_config);

  const paths = writeEnvAndConfig(envValues, configValues);

  s.stop(i18n.config_saved);

  // Step 13: Bootstrap (optional)
  let bootstrapCompleted = false;
  if (!options.skipBootstrap) {
    p.log.step("Agent Bootstrap");
    s.start("Running agent bootstrap...");

    try {
      await checkAndRunBootstrap();
      s.stop(pc.green("✅ Agent bootstrapped successfully"));
      bootstrapCompleted = true;
    } catch (error) {
      s.stop(pc.yellow("⚠️  Bootstrap failed, but setup continues"));
      console.warn("Bootstrap error:", error);
    }
  }

  // Completion
  p.outro(
    [
      pc.bgGreen(pc.black(i18n.complete_title)),
      "",
      pc.bold("Wizard Summary"),
      `  ${pc.cyan("Mode:")} ${wizardMode}`,
      `  ${pc.cyan("Setup:")} ${setupType}`,
      `  ${pc.cyan("Channels:")} ${enabledChannels.length}`,
      `  ${pc.cyan("Daemon:")} ${daemonEnabled ? "enabled" : "disabled"}`,
      `  ${pc.cyan("Health check:")} ${healthCheckRan ? "run" : "skipped"}`,
      `  ${pc.cyan("Skills:")} ${skillsRecommended ? "recommended" : "skipped"}`,
      `  ${pc.cyan("Config:")} ${paths.configPath}`,
      `  ${pc.cyan("Env:")} ${paths.envPath}`,
      "",
      pc.bold(i18n.next_steps_title),
      "",
      `  ${pc.cyan("krab chat")}     ${i18n.next_chat}`,
      `  ${pc.cyan("krab tui")}      ${i18n.next_tui}`,
      `  ${pc.cyan("krab ask")}      ${i18n.next_ask}`,
      `  ${pc.cyan("krab --help")}   ${i18n.next_help}`,
      "",
      pc.dim(i18n.saved_to.replace("{path}", paths.configPath)),
    ].join("\n"),
  );
}
