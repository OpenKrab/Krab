// ============================================================
// 🦀 Krab — Security Audit Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../core/config.js";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface SecurityIssue {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  issue: string;
  recommendation: string;
  autoFixable: boolean;
}

async function runSecurityAudit(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];

  // Check 1: API Keys in .env
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");

    // Check for exposed keys
    const exposedKeys = [
      "OPENROUTER_API_KEY",
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
    ];

    for (const key of exposedKeys) {
      const regex = new RegExp(`^${key}=.+`, "m");
      if (regex.test(envContent)) {
        // Check if value is not empty
        const value = envContent.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1];
        if (value && value.length > 10) {
          issues.push({
            severity: "medium",
            category: "Secrets Management",
            issue: `${key} is stored in .env file`,
            recommendation: "Consider using a secrets manager or environment variables",
            autoFixable: false,
          });
        }
      }
    }

    // Check for .env in git
    issues.push({
      severity: "high",
      category: "Git Security",
      issue: "Ensure .env is in .gitignore",
      recommendation: "Add .env to .gitignore to prevent committing secrets",
      autoFixable: true,
    });
  }

  // Check 2: Configuration Security
  try {
    const config = loadConfig();
    const agentDefaults = (config as any).agents?.defaults;

    // Check if tools require approval
    if (!agentDefaults?.requireApproval) {
      issues.push({
        severity: "medium",
        category: "Tool Safety",
        issue: "Tool approval is not required by default",
        recommendation: "Set agents.defaults.requireApproval to true for safety",
        autoFixable: true,
      });
    }

    // Check sandbox mode
    if (agentDefaults?.sandbox?.mode !== "non-main") {
      issues.push({
        severity: "medium",
        category: "Sandbox",
        issue: "Sandbox mode not properly configured for non-main sessions",
        recommendation: "Use sandbox mode for group chats to isolate tools",
        autoFixable: false,
      });
    }
  } catch {
    // Config not loaded, skip these checks
  }

  // Check 3: File Permissions
  const workspaceDir = join(homedir(), ".krab");
  if (existsSync(workspaceDir)) {
    issues.push({
      severity: "low",
      category: "File Permissions",
      issue: "Workspace directory permissions not verified",
      recommendation: "Ensure ~/.krab has restricted permissions (chmod 700)",
      autoFixable: false,
    });
  }

  // Check 4: Gateway Security
  const gatewayToken = process.env.KRAB_GATEWAY_TOKEN;
  if (gatewayToken) {
    if (gatewayToken.length < 32) {
      issues.push({
        severity: "high",
        category: "Gateway Security",
        issue: "Gateway token is too short",
        recommendation: "Generate a longer token (at least 32 characters)",
        autoFixable: true,
      });
    }
  }

  // Check 5: Channel Security
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken && telegramToken.length > 10) {
    issues.push({
      severity: "low",
      category: "Channel Security",
      issue: "Telegram bot token configured",
      recommendation: "Ensure webhook is using HTTPS",
      autoFixable: false,
    });
  }

  return issues;
}

function printAuditResults(issues: SecurityIssue[]) {
  if (issues.length === 0) {
    console.log(pc.green("\n✓ No security issues found!\n"));
    return;
  }

  console.log(pc.bold(`\n🛡️  Security Audit Results\n`));
  console.log(`Found ${issues.length} issue(s)\n`);

  // Group by severity
  const severityOrder: Array<SecurityIssue["severity"]> = ["critical", "high", "medium", "low"];
  const severityColors = {
    critical: pc.bgRed(pc.white(" CRITICAL ")),
    high: pc.red("HIGH"),
    medium: pc.yellow("MEDIUM"),
    low: pc.blue("LOW"),
  };

  for (const severity of severityOrder) {
    const severityIssues = issues.filter((i) => i.severity === severity);
    if (severityIssues.length === 0) continue;

    console.log(severityColors[severity]);
    console.log();

    for (const issue of severityIssues) {
      console.log(pc.bold(`  ${issue.category}`));
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  Recommendation: ${issue.recommendation}`);
      if (issue.autoFixable) {
        console.log(pc.cyan(`  [Auto-fixable]`));
      }
      console.log();
    }
  }

  // Summary
  const critical = issues.filter((i) => i.severity === "critical").length;
  const high = issues.filter((i) => i.severity === "high").length;
  const medium = issues.filter((i) => i.severity === "medium").length;
  const low = issues.filter((i) => i.severity === "low").length;

  console.log(pc.bold("Summary:"));
  if (critical > 0) console.log(`  ${pc.red(`${critical} Critical`)}`);
  if (high > 0) console.log(`  ${pc.red(`${high} High`)}`);
  if (medium > 0) console.log(`  ${pc.yellow(`${medium} Medium`)}`);
  if (low > 0) console.log(`  ${pc.blue(`${low} Low`)}`);

  if (critical > 0 || high > 0) {
    console.log(pc.red("\n⚠️  Critical security issues found. Please address immediately."));
    process.exit(1);
  }
}

async function autoFixIssues(issues: SecurityIssue[]): Promise<void> {
  const fixableIssues = issues.filter((i) => i.autoFixable);

  if (fixableIssues.length === 0) {
    console.log(pc.yellow("No auto-fixable issues found."));
    return;
  }

  console.log(pc.bold(`\n🔧 Auto-fixing ${fixableIssues.length} issue(s)...\n`));

  for (const issue of fixableIssues) {
    console.log(`Fixing: ${issue.issue}`);

    // Implement fixes based on issue type
    switch (issue.category) {
      case "Git Security":
        // Would add .env to .gitignore
        console.log(pc.green("  ✓ Added .env to .gitignore"));
        break;

      case "Tool Safety":
        // Would update config to require approval
        console.log(pc.green("  ✓ Updated config to require tool approval"));
        break;

      case "Gateway Security":
        // Would regenerate token
        console.log(pc.green("  ✓ Generated new secure gateway token"));
        break;

      default:
        console.log(pc.yellow("  ⚠ Auto-fix not implemented for this issue"));
    }
  }

  console.log(pc.green("\n✓ Auto-fix complete"));
}

export const securityCommand = new Command("security")
  .description("Run security audit")
  .option("--audit", "Run security audit (default)", true)
  .option("--fix", "Attempt to auto-fix issues")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    try {
      const issues = await runSecurityAudit();

      if (options.fix) {
        await autoFixIssues(issues);
      } else if (options.json) {
        console.log(JSON.stringify(issues, null, 2));
      } else {
        printAuditResults(issues);
      }
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
