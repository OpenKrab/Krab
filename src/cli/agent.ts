// ============================================================
// 🦀 Krab — Agent Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig, saveConfig } from "../core/config.js";
import { Agent } from "../core/agent.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

const AGENTS_FILE = join(homedir(), ".krab", "agents.json");

function loadAgents(): AgentProfile[] {
  if (!existsSync(AGENTS_FILE)) {
    return [
      {
        id: "default",
        name: "Default",
        description: "General purpose assistant",
        provider: "kilocode",
        model: "stepfun/step-3.5-flash:free",
      },
      {
        id: "coder",
        name: "Code Assistant",
        description: "Specialized in coding tasks",
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
      },
      {
        id: "creative",
        name: "Creative Writer",
        description: "Creative writing and content generation",
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
      },
    ];
  }

  try {
    const data = readFileSync(AGENTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveAgents(agents: AgentProfile[]) {
  const fs = require("fs");
  const dir = require("path").dirname(AGENTS_FILE);
  if (!existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
}

function getCurrentAgent(): string {
  return process.env.KRAB_AGENT || "default";
}

function printAgentList(agents: AgentProfile[]) {
  console.log(pc.bold("\n🤖 Agents\n"));

  const currentAgent = getCurrentAgent();

  for (const agent of agents) {
    const isCurrent = agent.id === currentAgent;
    const icon = isCurrent ? pc.green("→") : " ";
    const name = isCurrent ? pc.bold(pc.green(agent.name)) : agent.name;

    console.log(`${icon} ${name} ${pc.dim(`(${agent.id})`)}`);
    console.log(`  ${pc.dim(agent.description)}`);
    console.log(`  Provider: ${agent.provider} | Model: ${agent.model}`);
    console.log();
  }
}

function printAgentInfo(agent: AgentProfile) {
  console.log(pc.bold(`\n🤖 Agent: ${agent.name}\n`));
  console.log(`ID: ${agent.id}`);
  console.log(`Description: ${agent.description}`);
  console.log(`Provider: ${agent.provider}`);
  console.log(`Model: ${agent.model}`);

  if (agent.systemPrompt) {
    console.log(pc.bold("\nSystem Prompt:"));
    console.log(agent.systemPrompt);
  }

  if (agent.temperature !== undefined) {
    console.log(`\nTemperature: ${agent.temperature}`);
  }

  if (agent.maxTokens !== undefined) {
    console.log(`Max Tokens: ${agent.maxTokens}`);
  }
}

async function runAgent(agentId: string, message: string) {
  try {
    const agents = loadAgents();
    const agentProfile = agents.find((a) => a.id === agentId);

    if (!agentProfile) {
      console.error(pc.red(`Agent '${agentId}' not found`));
      process.exit(1);
    }

    console.log(pc.dim(`Using agent: ${agentProfile.name}\n`));

    const config = loadConfig();

    // Override with agent settings
    config.provider.name = agentProfile.provider;
    config.provider.model = agentProfile.model;

    const agent = new Agent(config);

    if (message) {
      // Single message mode
      console.log(pc.cyan("You: ") + message);
      console.log(pc.dim("\n🤔 Thinking..."));

      const response = await agent.chat(message);
      console.log(pc.green("\nAgent: ") + response + "\n");
    } else {
      // Interactive mode (would use chat interface)
      console.log(pc.yellow("Interactive mode not implemented. Use 'krab chat' instead."));
    }
  } catch (err: any) {
    console.error(pc.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

export const agentCommand = new Command("agent")
  .description("Manage and run agents")
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all agents")
      .action(() => {
        const agents = loadAgents();
        printAgentList(agents);
      })
  )
  .addCommand(
    new Command("info")
      .description("Show agent details")
      .argument("<agent-id>", "Agent ID")
      .action((agentId) => {
        const agents = loadAgents();
        const agent = agents.find((a) => a.id === agentId);

        if (!agent) {
          console.error(pc.red(`Agent '${agentId}' not found`));
          process.exit(1);
        }

        printAgentInfo(agent);
      })
  )
  .addCommand(
    new Command("run")
      .description("Run an agent with a message")
      .argument("<agent-id>", "Agent ID to run")
      .argument("[message]", "Message to send (optional)")
      .action(async (agentId, message) => {
        await runAgent(agentId, message);
      })
  )
  .addCommand(
    new Command("switch")
      .alias("use")
      .description("Switch default agent")
      .argument("<agent-id>", "Agent ID to switch to")
      .action((agentId) => {
        const agents = loadAgents();
        const agent = agents.find((a) => a.id === agentId);

        if (!agent) {
          console.error(pc.red(`Agent '${agentId}' not found`));
          process.exit(1);
        }

        console.log(pc.green(`✓ Switched to agent: ${agent.name}`));
        console.log(pc.dim(`Set KRAB_AGENT=${agentId} to persist`));
      })
  )
  .addCommand(
    new Command("create")
      .description("Create a new agent")
      .argument("<name>", "Agent name")
      .requiredOption("--id <id>", "Agent ID")
      .option("--description <desc>", "Agent description")
      .option("--provider <provider>", "Provider", "openrouter")
      .option("--model <model>", "Model", "google/gemini-2.5-flash")
      .option("--system-prompt <prompt>", "System prompt")
      .action((name, options) => {
        const agents = loadAgents();

        if (agents.find((a) => a.id === options.id)) {
          console.error(pc.red(`Agent '${options.id}' already exists`));
          process.exit(1);
        }

        const newAgent: AgentProfile = {
          id: options.id,
          name,
          description: options.description || "Custom agent",
          provider: options.provider,
          model: options.model,
          systemPrompt: options.systemPrompt,
        };

        agents.push(newAgent);
        saveAgents(agents);

        console.log(pc.green(`✓ Created agent: ${name}`));
      })
  );
