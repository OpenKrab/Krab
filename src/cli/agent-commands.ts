// ============================================================
// 🦀 Krab — Agent Management Commands
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig, saveConfig } from "../core/config.js";
import { AgentOverride, AgentBinding } from "../core/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Agent Commands ───────────────────────────────────────────
const agentCmd = new Command("agent")
  .description("Multi-agent management and routing")
  .action(async () => {
    await listAgents();
  });

// Subcommands
agentCmd
  .command("list")
  .description("List all configured agents")
  .option("--bindings", "Show agent bindings")
  .action(async (options) => {
    await listAgents(options);
  });

agentCmd
  .command("add <id>")
  .description("Add a new agent")
  .option("--workspace <path>", "Agent workspace path")
  .option("--model <model>", "Primary model for agent")
  .option("--default", "Set as default agent")
  .action(async (id, options) => {
    await addAgent(id, options);
  });

agentCmd
  .command("remove <id>")
  .description("Remove an agent")
  .action(async (id) => {
    await removeAgent(id);
  });

agentCmd
  .command("bind")
  .description("Create agent binding for routing")
  .requiredOption("--agent <id>", "Agent ID")
  .option("--channel <channel>", "Channel name")
  .option("--account <account>", "Account ID")
  .option("--peer-kind <kind>", "Peer kind (direct/group)")
  .option("--peer-id <id>", "Peer ID")
  .option("--guild <guild>", "Discord guild ID")
  .option("--roles <roles>", "Comma-separated Discord roles")
  .option("--priority <num>", "Binding priority", parseInt)
  .action(async (options) => {
    await addBinding(options);
  });

agentCmd
  .command("unbind <index>")
  .description("Remove agent binding by index")
  .action(async (index) => {
    await removeBinding(parseInt(index));
  });

agentCmd
  .command("bindings")
  .description("List all agent bindings")
  .action(async () => {
    await listBindings();
  });

// ── Command Implementations ──────────────────────────────────

async function listAgents(options?: { bindings?: boolean }): Promise<void> {
  const config = loadConfig();

  console.log(pc.bold("Configured Agents"));
  console.log("");

  const agents = config.agents?.list || [];
  if (agents.length === 0) {
    console.log(pc.dim("No agents configured."));
    console.log(pc.dim("Run 'krab agent add <id>' to create an agent."));
    return;
  }

  for (const agent of agents) {
    const isDefault = agent.default ? pc.green(" (default)") : "";
    console.log(`${pc.cyan(agent.id)}${isDefault}`);
    console.log(`  Workspace: ${agent.workspace || "inherited"}`);
    console.log(`  Model: ${agent.model?.primary || "inherited"}`);

    if (agent.tools) {
      console.log(`  Tools: ${agent.tools.profile || "inherited"}`);
    }

    console.log("");
  }

  if (options?.bindings) {
    await listBindings();
  }
}

async function addAgent(id: string, options: { workspace?: string; model?: string; default?: boolean }): Promise<void> {
  const config = loadConfig();

  // Initialize agents structure if needed
  if (!config.agents) {
    config.agents = { defaults: {} as any };
  }
  if (!config.agents.list) {
    config.agents.list = [];
  }

  // Check if agent already exists
  if (config.agents.list.some(a => a.id === id)) {
    console.log(pc.red(`Agent "${id}" already exists.`));
    return;
  }

  const agent: AgentOverride = {
    id,
    workspace: options.workspace,
    model: options.model ? { primary: options.model } : undefined
  };

  if (options.default) {
    // Remove default from other agents
    config.agents.list.forEach(a => a.default = false);
    agent.default = true;
  }

  config.agents.list.push(agent);
  saveConfig(config);

  console.log(pc.green(`✅ Agent "${id}" added successfully`));

  // Create workspace if specified
  if (options.workspace) {
    const workspacePath = path.resolve(options.workspace);
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
      console.log(pc.dim(`Created workspace: ${workspacePath}`));
    }
  }
}

async function removeAgent(id: string): Promise<void> {
  const config = loadConfig();

  if (!config.agents?.list) {
    console.log(pc.red("No agents configured."));
    return;
  }

  const index = config.agents.list.findIndex(a => a.id === id);
  if (index === -1) {
    console.log(pc.red(`Agent "${id}" not found.`));
    return;
  }

  config.agents.list.splice(index, 1);

  // Remove bindings for this agent
  if (config.agents.bindings) {
    config.agents.bindings = config.agents.bindings.filter(b => b.agentId !== id);
  }

  saveConfig(config);
  console.log(pc.green(`✅ Agent "${id}" removed successfully`));
}

async function addBinding(options: {
  agent: string;
  channel?: string;
  account?: string;
  peerKind?: string;
  peerId?: string;
  guild?: string;
  roles?: string;
  priority?: number;
}): Promise<void> {
  const config = loadConfig();

  // Initialize bindings structure
  if (!config.agents) {
    config.agents = { defaults: {} as any };
  }
  if (!config.agents.bindings) {
    config.agents.bindings = [];
  }

  // Check if agent exists
  const agents = config.agents.list || [];
  if (!agents.some(a => a.id === options.agent)) {
    console.log(pc.red(`Agent "${options.agent}" does not exist.`));
    console.log(pc.dim("Run 'krab agent list' to see available agents."));
    return;
  }

  const binding: AgentBinding = {
    agentId: options.agent,
    match: {},
    priority: options.priority
  };

  if (options.channel) {
    binding.match.channel = options.channel;
  }

  if (options.account) {
    binding.match.accountId = options.account;
  }

  if (options.peerKind && options.peerId) {
    binding.match.peer = {
      kind: options.peerKind as "direct" | "group",
      id: options.peerId
    };
  }

  if (options.guild) {
    binding.match.guildId = options.guild;
    if (options.roles) {
      binding.match.roles = options.roles.split(",");
    }
  }

  config.agents.bindings.push(binding);
  saveConfig(config);

  console.log(pc.green("✅ Agent binding added successfully"));
  console.log(pc.dim(`Agent: ${options.agent}`));
  console.log(pc.dim(`Match: ${JSON.stringify(binding.match)}`));
}

async function removeBinding(index: number): Promise<void> {
  const config = loadConfig();

  if (!config.agents?.bindings || index >= config.agents.bindings.length) {
    console.log(pc.red("Invalid binding index."));
    return;
  }

  const binding = config.agents.bindings[index];
  config.agents.bindings.splice(index, 1);
  saveConfig(config);

  console.log(pc.green("✅ Agent binding removed successfully"));
  console.log(pc.dim(`Agent: ${binding.agentId}`));
  console.log(pc.dim(`Match: ${JSON.stringify(binding.match)}`));
}

async function listBindings(): Promise<void> {
  const config = loadConfig();

  console.log(pc.bold("Agent Bindings"));
  console.log("");

  const bindings = config.agents?.bindings || [];
  if (bindings.length === 0) {
    console.log(pc.dim("No bindings configured."));
    console.log(pc.dim("Run 'krab agent bind --help' to see binding options."));
    return;
  }

  bindings.forEach((binding, index) => {
    console.log(`${index}. ${pc.cyan(binding.agentId)}`);
    console.log(`   Match: ${JSON.stringify(binding.match)}`);
    if (binding.priority) {
      console.log(`   Priority: ${binding.priority}`);
    }
    console.log("");
  });
}

export { agentCmd };
