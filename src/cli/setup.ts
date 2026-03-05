// ============================================================
// 🦀 Krab — Setup Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { runOnboarding } from "./onboarding.js";

export const setupCommand = new Command("setup")
  .description("Additional setup and configuration")
  .addCommand(
    new Command("wizard")
      .description("Run the setup wizard")
      .action(async () => {
        await runOnboarding();
      })
  )
  .addCommand(
    new Command("channels")
      .description("Setup messaging channels")
      .action(async () => {
        console.log(pc.bold("\n📡 Channel Setup\n"));
        console.log("Available channels:");
        console.log("  • Telegram - Messaging platform");
        console.log("  • Discord - Chat for communities");
        console.log("  • Slack - Workplace messaging");
        console.log("  • LINE - Popular in Asia");
        console.log();
        console.log(pc.dim("Run 'krab channels add <channel>' to configure\n"));
      })
  )
  .addCommand(
    new Command("tools")
      .description("Configure tool settings")
      .action(async () => {
        console.log(pc.bold("\n🛠️  Tool Configuration\n"));
        console.log("Settings:");
        console.log("  • Require approval for side-effect tools: ✓");
        console.log("  • Sandbox mode: disabled");
        console.log("  • Auto-approve read-only tools: ✓");
        console.log();
        console.log(pc.dim("Edit .env file to change tool settings\n"));
      })
  )
  .addCommand(
    new Command("memory")
      .description("Configure memory settings")
      .action(async () => {
        console.log(pc.bold("\n🧠 Memory Configuration\n"));
        console.log("Long-term memory: enabled");
        console.log("Vector search: enabled");
        console.log("Max conversations: unlimited");
        console.log();
        console.log(pc.dim("Memory is stored in ~/.krab/\n"));
      })
  );
