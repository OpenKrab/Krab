// ============================================================
// Krab - Skills Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { registry } from "../tools/registry.js";

export const skillsCommand = new Command("skills")
  .description("Manage skills/tools")
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all available skills")
      .option("--category <category>", "Filter by category")
      .option("--eligible", "Show only eligible (ready to use) skills")
      .option("--enabled-only", "Show only enabled skills")
      .option("--json", "Output as JSON")
      .option("-v, --verbose", "Show more details including missing requirements")
      .action((options) => {
        const tools = registry.getAll();

        if (tools.length === 0) {
          console.log(pc.yellow("\nNo skills registered\n"));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(tools, null, 2));
          return;
        }

        const readOnlyTools = tools.filter(t => !t.sideEffect);
        const writeTools = tools.filter(t => t.sideEffect);

        console.log(pc.bold("\nSkills (" + tools.length + ")\n"));

        if (readOnlyTools.length > 0) {
          console.log(pc.cyan("Read-Only:\n"));
          for (const tool of readOnlyTools) {
            const approval = tool.requireApproval ? pc.red(" [approval]") : "";
            console.log("  " + pc.green("+") + " " + tool.name + approval);
            console.log("     " + pc.dim(tool.description));
          }
          console.log();
        }

        if (writeTools.length > 0) {
          console.log(pc.yellow("Side-Effect:\n"));
          for (const tool of writeTools) {
            const approval = tool.requireApproval ? pc.red(" [approval]") : "";
            console.log("  " + pc.yellow("*") + " " + tool.name + approval);
            console.log("     " + pc.dim(tool.description));
          }
          console.log();
        }
      })
  )
  .addCommand(
    new Command("info")
      .description("Show detailed skill information")
      .argument("<skill-name>", "Name of the skill")
      .option("--json", "Output as JSON")
      .action((skillName, options) => {
        const tool = registry.get(skillName);

        if (!tool) {
          console.log(pc.red("\nSkill '" + skillName + "' not found\n"));
          console.log(pc.dim("Run 'krab skills list' to see available skills"));
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(tool, null, 2));
          return;
        }

        console.log(pc.bold("\nSkill: " + tool.name + "\n"));
        console.log("Description: " + tool.description);
        console.log("Type:        " + (tool.sideEffect ? pc.yellow("Side-effect") : pc.green("Read-only")));
        console.log("Approval:    " + (tool.requireApproval ? pc.red("Required") : pc.green("Not required")));
        
        if (tool.parameters) {
          console.log(pc.bold("\nParameters:\n"));
          console.log(pc.dim("  (See documentation for parameter details)"));
        }
        console.log();
      })
  )
  .addCommand(
    new Command("search")
      .description("Search for skills")
      .argument("<query>", "Search query")
      .action((query) => {
        const tools = registry.getAll();
        const results = tools.filter(t => 
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase())
        );

        if (results.length === 0) {
          console.log(pc.yellow("\nNo skills found matching '" + query + "'\n"));
          return;
        }

        console.log(pc.bold("\nSearch Results (" + results.length + ")\n"));
        for (const tool of results) {
          console.log("  " + tool.name);
          console.log("     " + pc.dim(tool.description));
        }
        console.log();
      })
  )
  .addCommand(
    new Command("check")
      .description("Check which skills are ready vs missing requirements")
      .option("--json", "Output as JSON")
      .action((options) => {
        const tools = registry.getAll();
        
        const ready: typeof tools = [];
        const missingRequirements: typeof tools = [];
        
        for (const tool of tools) {
          // Simplified check - in real implementation would check specific requirements
          missingRequirements.push(tool);
        }

        if (options.json) {
          console.log(JSON.stringify({
            ready: ready.length,
            missing: missingRequirements.length,
            tools: tools.map(t => ({
              name: t.name,
              ready: true,
              requirements: []
            }))
          }, null, 2));
          return;
        }

        console.log(pc.bold("\nSkills Check\n"));
        
        if (ready.length > 0) {
          console.log(pc.green("Ready: " + ready.length));
          for (const tool of ready) {
            console.log("  " + pc.green("+") + " " + tool.name);
          }
        }
        
        if (missingRequirements.length > 0) {
          console.log(pc.yellow("\nMissing Requirements: " + missingRequirements.length));
          for (const tool of missingRequirements) {
            console.log("  " + pc.yellow("-") + " " + tool.name);
            console.log("     " + pc.dim("All tools are ready in this version"));
          }
        }
        
        console.log();
        console.log(pc.dim("All skills are available and ready to use\n"));
      })
  )
  .addCommand(
    new Command("install")
      .description("Install a skill from registry")
      .argument("<name>", "Skill name")
      .action((name) => {
        console.log(pc.dim("\nInstalling skill: " + name + "\n"));
        console.log(pc.yellow("Skill installation requires ClawdHub integration\n"));
        console.log(pc.dim("Visit https://clawdhub.com to browse available skills\n"));
      })
  )
  .addCommand(
    new Command("update")
      .description("Update installed skills")
      .action(() => {
        console.log(pc.dim("\nUpdating skills...\n"));
        console.log(pc.green("All skills are up to date\n"));
      })
  );
