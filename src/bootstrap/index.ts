// ============================================================
// 🦀 Krab — Bootstrap System
// ============================================================
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { loadConfig } from "../core/config.js";
import { Agent } from "../core/agent.js";

export interface BootstrapOptions {
  workspacePath: string;
  force?: boolean;
}

export class BootstrapManager {
  private workspacePath: string;
  private bootstrapMdPath: string;

  constructor(options: BootstrapOptions) {
    this.workspacePath = options.workspacePath;
    this.bootstrapMdPath = path.join(this.workspacePath, "BOOTSTRAP.md");

    // Ensure workspace exists
    if (!fs.existsSync(this.workspacePath)) {
      fs.mkdirSync(this.workspacePath, { recursive: true });
    }
  }

  /**
   * Check if bootstrapping is needed (BOOTSTRAP.md exists)
   */
  needsBootstrapping(): boolean {
    return fs.existsSync(this.bootstrapMdPath);
  }

  /**
   * Run the complete bootstrap process
   */
  async runBootstrap(): Promise<void> {
    try {
      logger.info("[Bootstrap] Starting agent bootstrapping...");

      // Seed initial files
      await this.seedInitialFiles();

      // Run Q&A ritual
      const answers = await this.runQARitual();

      // Generate identity files
      await this.generateIdentityFiles(answers);

      // Mark bootstrap complete
      this.markBootstrapComplete();

      logger.info("[Bootstrap] Bootstrapping completed successfully!");

    } catch (error) {
      logger.error("[Bootstrap] Bootstrapping failed:", error);
      throw error;
    }
  }

  /**
   * Seed initial bootstrap files
   */
  private async seedInitialFiles(): Promise<void> {
    const files = {
      "AGENTS.md": `# Krab Agents

This workspace contains Krab-powered AI agents.

## Current Agents

- **Krab**: Main agent instance
  - Framework: Krab v0.1.0
  - Capabilities: Chat, tools, channels, memory
  - Status: Active

## Agent Management

Agents in this workspace are managed through Krab's configuration system.
`,

      "BOOTSTRAP.md": `# Krab Agent Bootstrap

Welcome to Krab! This file indicates that your agent needs initial setup.

## What happens next?

1. **Q&A Ritual**: We'll ask a few questions to understand your preferences
2. **Identity Generation**: Create personalized agent personality files
3. **Workspace Setup**: Configure your agent workspace

## Questions we'll ask:

- Your name and preferred interaction style
- Areas of expertise and interests
- Communication preferences
- Workspace customization

This process helps tailor Krab to your needs.

## Ready to begin?

Run \`krab bootstrap\` to start the process.
`,

      "IDENTITY.md": `# Agent Identity (To be generated)

This file will contain your agent's core identity and personality.
`,

      "USER.md": `# User Profile (To be generated)

This file will contain information about you and your preferences.
`,

      "SOUL.md": `# Agent Soul (To be generated)

This file will contain your agent's deeper personality traits and values.
`
    };

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(this.workspacePath, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
        logger.debug(`[Bootstrap] Created ${filename}`);
      }
    }
  }

  /**
   * Run the Q&A ritual to gather user preferences
   */
  private async runQARitual(): Promise<Record<string, string>> {
    const questions = [
      {
        key: "user_name",
        question: "What's your name?",
        default: "User"
      },
      {
        key: "interaction_style",
        question: "How would you like the agent to interact with you? (formal/casual/friendly/technical)",
        default: "friendly"
      },
      {
        key: "expertise_areas",
        question: "What areas are you most interested in? (programming/AI/writing/research/other)",
        default: "programming"
      },
      {
        key: "communication_preference",
        question: "Do you prefer concise or detailed responses? (concise/detailed/balanced)",
        default: "balanced"
      },
      {
        key: "agent_name",
        question: "What would you like to name your agent?",
        default: "Krab"
      }
    ];

    const answers: Record<string, string> = {};

    // In a real implementation, this would use readline or a UI
    // For now, use defaults
    for (const q of questions) {
      answers[q.key] = q.default;
      logger.info(`[Bootstrap] ${q.question} → ${q.default}`);
    }

    return answers;
  }

  /**
   * Generate identity files based on answers
   */
  private async generateIdentityFiles(answers: Record<string, string>): Promise<void> {
    const identityContent = `# Agent Identity

## Name
${answers.agent_name}

## Personality
- **Style**: ${answers.interaction_style}
- **Communication**: ${answers.communication_preference} responses
- **Expertise Focus**: ${answers.expertise_areas}

## Core Values
- Helpful and truthful
- Adaptable to user preferences
- Focused on ${answers.expertise_areas} tasks

## Background
Built with Krab framework, inspired by OpenClaw.
Optimized for ${answers.interaction_style} interactions.
`;

    const userContent = `# User Profile

## Name
${answers.user_name}

## Preferences
- **Interaction Style**: ${answers.interaction_style}
- **Expertise Areas**: ${answers.expertise_areas}
- **Response Preference**: ${answers.communication_preference}

## Agent Relationship
- **Agent Name**: ${answers.agent_name}
- **Framework**: Krab
`;

    const soulContent = `# Agent Soul

## Essence
A helpful AI assistant built with the Krab framework.

## Values
- **Truthfulness**: Always strive for accuracy
- **Helpfulness**: Assist users effectively
- **Adaptability**: Learn and adjust to user needs
- **Efficiency**: Provide ${answers.communication_preference} responses

## Personality Traits
- **Style**: ${answers.interaction_style}
- **Focus**: ${answers.expertise_areas}
- **Communication**: Clear and ${answers.communication_preference}

## Purpose
To be a reliable companion for ${answers.expertise_areas} tasks and general assistance.
`;

    const files = {
      "IDENTITY.md": identityContent,
      "USER.md": userContent,
      "SOUL.md": soulContent
    };

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(this.workspacePath, filename);
      fs.writeFileSync(filePath, content);
      logger.debug(`[Bootstrap] Generated ${filename}`);
    }
  }

  /**
   * Mark bootstrap as complete by removing BOOTSTRAP.md
   */
  private markBootstrapComplete(): void {
    if (fs.existsSync(this.bootstrapMdPath)) {
      fs.unlinkSync(this.bootstrapMdPath);
      logger.info("[Bootstrap] Bootstrap completed - removed BOOTSTRAP.md");
    }
  }

  /**
   * Force re-bootstrap (for development/testing)
   */
  forceRebootstrap(): void {
    // Remove existing files to force re-run
    const filesToRemove = ["AGENTS.md", "IDENTITY.md", "USER.md", "SOUL.md"];
    for (const file of filesToRemove) {
      const filePath = path.join(this.workspacePath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Recreate BOOTSTRAP.md
    this.seedInitialFiles();
    logger.info("[Bootstrap] Forced re-bootstrap - BOOTSTRAP.md recreated");
  }
}

// Export convenience functions
export async function checkAndRunBootstrap(): Promise<void> {
  const config = loadConfig();
  const workspacePath = config.agents?.defaults?.workspace || path.join(os.homedir(), ".krab", "workspace");

  const bootstrap = new BootstrapManager({ workspacePath });

  if (bootstrap.needsBootstrapping()) {
    await bootstrap.runBootstrap();
  }
}

export function createBootstrapManager(options: BootstrapOptions): BootstrapManager {
  return new BootstrapManager(options);
}
