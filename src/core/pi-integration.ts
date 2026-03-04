// ============================================================
// 🦀 Krab — Pi Integration (OpenClaw-inspired)
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { logger } from "../utils/logger.js";
import type { KrabConfig } from "./types.js";

export interface BootstrapFiles {
  agents?: string;
  soul?: string;
  tools?: string;
  bootstrap?: string;
  identity?: string;
  user?: string;
}

export interface WorkspaceConfig {
  workspace: string;
  agentId: string;
  bootstrapFiles: BootstrapFiles;
}

export class PiIntegration {
  private workspace: string;
  private agentId: string;
  private config: KrabConfig;

  constructor(config: KrabConfig) {
    this.workspace = resolve(config.agents?.defaults?.workspace || "~/.krab/workspace");
    this.agentId = "krab"; // Default agent ID
    this.config = config;
    this.ensureWorkspace();
  }

  private ensureWorkspace(): void {
    if (!existsSync(this.workspace)) {
      mkdirSync(this.workspace, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ["skills", "sessions", "extensions"];
    for (const subdir of subdirs) {
      const fullPath = resolve(this.workspace, subdir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }

    logger.info(`[Pi] Workspace ready: ${this.workspace}`);
  }

  // Bootstrap file management
  createBootstrapFiles(options: {
    skipBootstrap?: boolean;
    agentName?: string;
    persona?: string;
    tools?: string[];
  } = {}): void {
    const { skipBootstrap = false, agentName = "Krab", persona, tools } = options;

    if (skipBootstrap) {
      logger.info("[Pi] Skipping bootstrap creation");
      return;
    }

    // AGENTS.md - Operating instructions + memory
    const agentsContent = `# 🦀 Krab Agent Configuration

## Operating Instructions
- You are Krab, a lightweight but powerful AGI assistant
- Primary function: Help users with coding, analysis, and problem-solving
- Approach: Think step-by-step, use tools efficiently, reflect on responses
- Memory: Maintain conversation context and learn from interactions
- Safety: Always verify tool outputs and handle errors gracefully

## Memory Strategy
- Short-term: Recent conversation history (last 50 messages)
- Long-term: Vector embeddings for semantic search
- Session persistence: Save conversations for continuity

## Tool Usage Guidelines
- Read-only tools can be used in parallel for efficiency
- Write operations require explicit confirmation
- Always explain dangerous operations before executing
- Use semantic search to find relevant past information

## Error Handling
- Retry failed operations up to 3 times
- If all retries fail, explain the issue clearly
- Log errors for debugging and learning
`;

    this.writeBootstrapFile("agents", agentsContent);

    // SOUL.md - Persona, boundaries, tone
    const soulContent = `# 🦀 Krab Soul

## Persona
- Name: Krab (ปูเป็นปู)
- Core identity: Lightweight, smart, helpful AGI assistant
- Personality: Precise, efficient, slightly playful with 🦀 emoji
- Tone: Professional but approachable, technical but clear

## Core Principles
1. **Accuracy First**: Verify information before sharing
2. **Efficiency**: Use tools and memory to minimize redundant work
3. **Clarity**: Explain complex concepts simply
4. **Safety**: Validate tool outputs and handle errors
5. **Learning**: Remember important information for future reference

## Boundaries
- No access to external systems without explicit user permission
- Cannot make real-world changes without confirmation
- Respect privacy and security constraints
- Admit when information is unknown rather than guessing

## Voice & Style
- Use 🦀 emoji sparingly for personality
- Technical: Explain code and concepts clearly
- Concise: Get to the point without unnecessary fluff
- Helpful: Provide actionable advice and solutions
${persona ? `\n\n## Custom Persona\n${persona}` : ""}
`;

    this.writeBootstrapFile("soul", soulContent);

    // TOOLS.md - User-maintained tool notes
    const toolsContent = `# 🛠️ Krab Tools Documentation

## Built-in Tools
- **datetime**: Get current date/time and timezone info
- **shell**: Execute system commands (with safety checks)
- **search**: Web search for information gathering
- **file_ops**: Read, write, list files and directories
- **agent_search**: Search across conversations and memory

## Tool Categories
- **Read-only**: datetime, search, file_read, file_list, agent_search
- **Write**: file_write, shell (with approval)
- **Dangerous**: shell (requires explicit confirmation)

## Usage Guidelines
- Parallel execution: Read-only tools can be used together
- Sequential execution: Write operations one at a time
- Error handling: Always check tool results before proceeding
${tools ? `\n\n## Custom Tools\n${tools.map(tool => `- ${tool}`).join("\n")}` : ""}

## Tool Development
- Add new tools to src/tools/built-in/
- Register in tools/registry.ts
- Follow the Tool interface pattern
- Include proper error handling and validation
`;

    this.writeBootstrapFile("tools", toolsContent);

    // BOOTSTRAP.md - One-time first-run ritual
    const bootstrapContent = `# 🚀 Krab Bootstrap

## First Run Setup
Welcome to Krab! This is a one-time setup ritual to initialize your AI agent.

## ✅ Setup Checklist
- [x] Workspace created: ${this.workspace}
- [x] Bootstrap files generated
- [ ] LLM provider configured
- [ ] API keys validated
- [ ] Tools tested

## 🎯 Next Steps
1. Run \`npm run dev -- wizard\` to configure LLM provider
2. Test basic functionality with \`npm run dev -- ask "Hello Krab"\`
3. Start interactive chat with \`npm run dev -- chat\`

## 🧠 Memory Initialization
- Short-term memory: Ready for conversation history
- Long-term memory: Vector database prepared for semantic search
- Session persistence: Conversation files will be saved automatically

## 🔧 Configuration
- Main config: krab.json (advanced settings)
- Environment: .env (API keys and basic settings)
- Language support: Thai/English (selected during setup)

## 🌐 Gateway Information
- Default port: 18789
- WebSocket endpoint: ws://localhost:18789
- HTTP API: http://localhost:18789
- Control UI: http://localhost:18789/krab

---

*This file will be automatically deleted after successful first run.*
`;

    this.writeBootstrapFile("bootstrap", bootstrapContent);

    // IDENTITY.md - Agent name/vibe/emoji
    const identityContent = `# 🦀 Krab Identity

## Agent Information
- **Name**: Krab (กระบอ)
- **Species**: Crab (สัตว์ปู)
- **Type**: AGI Assistant
- **Version**: 0.1.0
- **Framework**: Node.js + TypeScript

## Personality Traits
- **Smart**: Can reason, plan, and learn
- **Efficient**: Lightweight and fast
- **Helpful**: Genuinely wants to assist users
- **Adaptable**: Works with multiple LLM providers
- **Safe**: Includes error handling and validation

## Visual Identity
- **Emoji**: 🦀 (used sparingly for personality)
- **Color Scheme**: Blue/cyan (technical, trustworthy)
- **Style**: Clean, minimal, functional

## Capabilities
- **Conversation**: Multi-turn dialogue with memory
- **Tools**: File operations, web search, system commands
- **Memory**: Both short-term and long-term with vector search
- **Reflection**: Self-evaluation and quality improvement
- **Gateway**: HTTP APIs and WebSocket connections
- **Multi-language**: Thai and English support

## Mission
> "Be the lightweight, smart assistant that gets things done efficiently and safely."

---

*Last updated: ${new Date().toISOString()}*
`;

    this.writeBootstrapFile("identity", identityContent);

    // USER.md - User profile and preferences
    const userContent = `# 👤 User Profile

## Default User
- **Name**: User (customizable)
- **Language**: Thai/English (selected during setup)
- **Timezone**: Asia/Bangkok (default, configurable)
- **Preferences**: 
  - Concise responses preferred
  - Code examples when helpful
  - Safety confirmations for dangerous operations

## Customization
Edit this file to personalize your Krab experience:
- Add your name and preferences
- Set your preferred language and timezone
- Configure tool usage policies
- Customize agent behavior and responses

## Privacy
- User data is stored locally in workspace
- No data is sent to external servers without explicit consent
- API keys are stored in environment variables only

---

*Configure your preferences by editing this file.*
`;

    this.writeBootstrapFile("user", userContent);

    logger.info("[Pi] Bootstrap files created successfully");
  }

  private writeBootstrapFile(type: keyof BootstrapFiles, content: string): void {
    const filePath = resolve(this.workspace, `${type.toUpperCase()}.md`);
    writeFileSync(filePath, content, "utf-8");
    logger.debug(`[Pi] Created ${type.toUpperCase()}.md`);
  }

  // Session management
  createSession(sessionId: string): string {
    const sessionsDir = resolve(this.workspace, "sessions");
    if (!existsSync(sessionsDir)) {
      mkdirSync(sessionsDir, { recursive: true });
    }

    const sessionFile = resolve(sessionsDir, `${sessionId}.jsonl`);
    return sessionFile;
  }

  saveSession(sessionId: string, data: any): void {
    const sessionFile = this.createSession(sessionId);
    const sessionData = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        agentId: this.agentId,
        version: "0.1.0"
      }
    };

    // Append to JSONL file
    const line = JSON.stringify(sessionData) + "\n";
    require("fs").appendFileSync(sessionFile, line, "utf-8");
  }

  loadSession(sessionId: string): any | null {
    const sessionFile = resolve(this.workspace, "sessions", `${sessionId}.jsonl`);
    
    if (!existsSync(sessionFile)) {
      return null;
    }

    try {
      const content = readFileSync(sessionFile, "utf-8");
      const lines = content.trim().split("\n");
      
      // Get last line (most recent)
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        return JSON.parse(lastLine);
      }
      
      return null;
    } catch (error) {
      logger.error(`[Pi] Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  listSessions(): string[] {
    const sessionsDir = resolve(this.workspace, "sessions");
    if (!existsSync(sessionsDir)) {
      return [];
    }

    try {
      const files = require("fs").readdirSync(sessionsDir);
      return files
        .filter((file: string) => file.endsWith(".jsonl"))
        .map((file: string) => file.replace(".jsonl", ""));
    } catch (error) {
      logger.error("[Pi] Failed to list sessions:", error);
      return [];
    }
  }

  deleteSession(sessionId: string): void {
    const sessionFile = resolve(this.workspace, "sessions", `${sessionId}.jsonl`);
    
    try {
      require("fs").unlinkSync(sessionFile);
      logger.info(`[Pi] Deleted session ${sessionId}`);
    } catch (error) {
      logger.error(`[Pi] Failed to delete session ${sessionId}:`, error);
    }
  }

  // Skills management
  createSkill(name: string, content: string): void {
    const skillsDir = resolve(this.workspace, "skills");
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }

    const skillFile = resolve(skillsDir, `${name}.md`);
    writeFileSync(skillFile, content, "utf-8");
    logger.info(`[Pi] Created skill: ${name}`);
  }

  listSkills(): string[] {
    const skillsDir = resolve(this.workspace, "skills");
    if (!existsSync(skillsDir)) {
      return [];
    }

    try {
      const files = require("fs").readdirSync(skillsDir);
      return files.filter((file: string) => file.endsWith(".md"));
    } catch (error) {
      logger.error("[Pi] Failed to list skills:", error);
      return [];
    }
  }

  // Extension loading
  loadExtensions(extensionPaths: string[] = []): any[] {
    const extensions: any[] = [];
    
    // Default extension paths
    const defaultPaths = [
      resolve(this.workspace, "extensions"),
      resolve(process.cwd(), "extensions")
    ];

    const allPaths = [...defaultPaths, ...extensionPaths];

    for (const extPath of allPaths) {
      if (existsSync(extPath)) {
        try {
          const files = require("fs").readdirSync(extPath);
          for (const file of files) {
            if (file.endsWith(".js") || file.endsWith(".ts")) {
              const modulePath = resolve(extPath, file);
              // Dynamic import would go here
              extensions.push({
                name: file.replace(/\.(js|ts)$/, ""),
                path: modulePath
              });
            }
          }
        } catch (error) {
          logger.warn(`[Pi] Failed to load extension from ${extPath}:`, error);
        }
      }
    }

    logger.info(`[Pi] Loaded ${extensions.length} extensions`);
    return extensions;
  }

  // Workspace utilities
  getWorkspaceInfo(): {
    workspace: string;
    agentId: string;
    bootstrapFiles: string[];
    sessions: string[];
    skills: string[];
    extensions: string[];
  } {
    return {
      workspace: this.workspace,
      agentId: this.agentId,
      bootstrapFiles: this.getBootstrapFiles(),
      sessions: this.listSessions(),
      skills: this.listSkills(),
      extensions: this.loadExtensions().map(ext => ext.name)
    };
  }

  private getBootstrapFiles(): string[] {
    const files = ["agents", "soul", "tools", "bootstrap", "identity", "user"];
    const existing: string[] = [];
    
    for (const file of files) {
      const filePath = resolve(this.workspace, `${file.toUpperCase()}.md`);
      if (existsSync(filePath)) {
        existing.push(file);
      }
    }
    
    return existing;
  }

  // Cleanup bootstrap after first run
  cleanupBootstrap(): void {
    const bootstrapFile = resolve(this.workspace, "BOOTSTRAP.md");
    if (existsSync(bootstrapFile)) {
      try {
        require("fs").unlinkSync(bootstrapFile);
        logger.info("[Pi] Bootstrap completed - BOOTSTRAP.md removed");
      } catch (error) {
        logger.warn("[Pi] Failed to remove BOOTSTRAP.md:", error);
      }
    }
  }
}
