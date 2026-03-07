// ============================================================
// 🦀 Krab — Bundled Hook: Bootstrap Extra Files Handler
// ============================================================
import { HookHandler, HookEvent } from "../../index.js";
import { logger } from "../../../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

const bootstrapExtraFilesHandler: HookHandler = {
  async execute(event: HookEvent): Promise<void> {
    try {
      if (event.type === "message:user") {
        const workspaceDir = process.cwd();

        // Check if this is a new Krab workspace (has package.json or not)
        const packageJsonPath = path.join(workspaceDir, "package.json");
        const hasPackageJson = fs.existsSync(packageJsonPath);

        if (!hasPackageJson) {
          // Bootstrap basic files for new Krab project
          bootstrapBasicFiles(workspaceDir);
          logger.info("[BootstrapExtraFiles] Bootstrapped basic files for new workspace");
        }
      }
    } catch (error) {
      logger.error("[BootstrapExtraFiles] Failed to bootstrap files:", error);
    }
  }
};

function bootstrapBasicFiles(workspaceDir: string): void {
  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(workspaceDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    const gitignoreContent = `# Krab workspace
.env
.env.local
*.log
node_modules/
dist/
.krab/
sessions/
`;
    fs.writeFileSync(gitignorePath, gitignoreContent);
  }

  // Create README.md if it doesn't exist
  const readmePath = path.join(workspaceDir, "README.md");
  if (!fs.existsSync(readmePath)) {
    const readmeContent = `# My Krab Project

This is a Krab-powered AI agent project.

## Getting Started

1. Configure Krab: \`krab onboard\`
2. Start chatting: \`krab\` or \`krab chat\`

## Hooks

This workspace includes automation hooks in \`hooks/\` directory.

## Skills

Add custom skills in \`skills/\` directory.
`;
    fs.writeFileSync(readmePath, readmeContent);
  }

  // Create hooks directory structure
  const hooksDir = path.join(workspaceDir, "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });

    // Create example hook
    const exampleHookDir = path.join(hooksDir, "example-hook");
    fs.mkdirSync(exampleHookDir);

    const exampleHookMd = `---
name: example-hook
description: "Example hook - customize as needed"
homepage: ""
metadata:
  openclaw:
    emoji: "🔧"
    events: ["message:user"]
    export: "default"
    requires:
      bins: []
      os: []
---

# Example Hook

This is an example hook to demonstrate the structure.

## What it does

- Listens for user messages
- Performs custom automation

## Configuration

No configuration needed.
`;

    const exampleHandler = `// Example hook handler
import { HookHandler, HookEvent } from "../../src/hooks/index.js";

const exampleHandler: HookHandler = {
  async execute(event: HookEvent): Promise<void> {
    console.log("Example hook executed for event:", event.type);
    // Add your custom logic here
  }
};

export default exampleHandler;
`;

    fs.writeFileSync(path.join(exampleHookDir, "HOOK.md"), exampleHookMd);
    fs.writeFileSync(path.join(exampleHookDir, "handler.ts"), exampleHandler);
  }
}

export default bootstrapExtraFilesHandler;
