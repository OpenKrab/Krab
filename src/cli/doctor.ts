// ============================================================
// 🦀 Krab — Doctor Command (System Health Check)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../core/config.js";
import { registry } from "../tools/registry.js";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { printBanner, printInfo, printSection, printWarning } from "../tui/style.js";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
  fix?: string;
}

async function runHealthCheck(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: Configuration
  try {
    const config = loadConfig();
    results.push({
      name: "Configuration",
      status: "ok",
      message: `Config loaded successfully (${config.provider.name})`,
    });
  } catch (err: any) {
    results.push({
      name: "Configuration",
      status: "error",
      message: `Failed to load config: ${err.message}`,
      fix: "Run 'krab onboard' to setup",
    });
  }

  // Check 2: API Keys
  const requiredKeys = [
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "KILOCODE_API_KEY",
  ];
  const availableKeys = requiredKeys.filter((key) => process.env[key]);

  if (availableKeys.length === 0) {
    results.push({
      name: "API Keys",
      status: "error",
      message: "No API keys configured",
      fix: "Set at least one API key in .env file",
    });
  } else {
    results.push({
      name: "API Keys",
      status: "ok",
      message: `${availableKeys.length} API key(s) configured`,
    });
  }

  // Check 3: Tools
  const toolCount = registry.getAll().length;
  if (toolCount === 0) {
    results.push({
      name: "Tools",
      status: "warn",
      message: "No tools registered",
    });
  } else {
    results.push({
      name: "Tools",
      status: "ok",
      message: `${toolCount} tools available`,
    });
  }

  // Check 4: Workspace
  const workspaceDir = join(homedir(), ".krab");
  if (!existsSync(workspaceDir)) {
    results.push({
      name: "Workspace",
      status: "warn",
      message: "Workspace directory not found",
      fix: `Create directory: ${workspaceDir}`,
    });
  } else {
    results.push({
      name: "Workspace",
      status: "ok",
      message: `Workspace ready at ${workspaceDir}`,
    });
  }

  // Check 5: Memory/Database
  const memoryDb = join(workspaceDir, "memory.db");
  if (!existsSync(memoryDb)) {
    results.push({
      name: "Memory Database",
      status: "warn",
      message: "Memory database not initialized",
      fix: "Memory will be created on first use",
    });
  } else {
    results.push({
      name: "Memory Database",
      status: "ok",
      message: "Memory database exists",
    });
  }

  return results;
}

async function checkProviderConnection(provider: string): Promise<CheckResult> {
  try {
    // Simple fetch to check connectivity
    const testUrl = "https://openrouter.ai/api/v1/models";
    const response = await fetch(testUrl, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
      },
    });

    if (response.ok || response.status === 401) {
      // 401 means API is reachable but unauthorized
      return {
        name: "Provider Connection",
        status: "ok",
        message: "Can reach AI provider",
      };
    }
  } catch (err) {
    return {
      name: "Provider Connection",
      status: "error",
      message: "Cannot connect to AI provider",
      fix: "Check internet connection",
    };
  }

  return {
    name: "Provider Connection",
    status: "warn",
    message: "Provider status unknown",
  };
}

function printResults(results: CheckResult[]) {
  printBanner("Diagnostic Control Grid");
  printSection("Health Check Matrix");

  let okCount = 0;
  let warnCount = 0;
  let errorCount = 0;

  for (const result of results) {
    const icon =
      result.status === "ok"
        ? pc.green("ONLINE")
        : result.status === "warn"
        ? pc.yellow("WARN")
        : pc.red("FAULT");

    const statusColor =
      result.status === "ok"
        ? pc.green
        : result.status === "warn"
        ? pc.yellow
        : pc.red;

    console.log(`${icon} ${pc.bold(result.name)} ${statusColor(result.status.toUpperCase())}`);
    console.log(`  ${result.message}`);

    if (result.fix) {
      console.log(`  ${pc.cyan("Remediation:")} ${result.fix}`);
    }
    console.log();

    if (result.status === "ok") okCount++;
    if (result.status === "warn") warnCount++;
    if (result.status === "error") errorCount++;
  }

  // Summary
  printSection("Summary");
  console.log(`  ${pc.green(`${okCount} OK`)}`);
  if (warnCount > 0) console.log(`  ${pc.yellow(`${warnCount} Warning(s)`)}`);
  if (errorCount > 0) console.log(`  ${pc.red(`${errorCount} Error(s)`)}`);

  if (errorCount > 0) {
    printWarning("Health check failed. Resolve faults before continued operation.");
    process.exit(1);
  } else if (warnCount > 0) {
    printWarning("Health check passed with warnings.");
  } else {
    printInfo("All checks passed. Reactor state is stable.");
  }
}

export const doctorCommand = new Command("doctor")
  .description("Run system health check and diagnostics")
  .option("--fix", "Attempt to auto-fix issues")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    try {
      const results = await runHealthCheck();

      // Check provider connection
      const providerResult = await checkProviderConnection("openrouter");
      results.push(providerResult);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        printResults(results);
      }
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
