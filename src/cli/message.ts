// ============================================================
// 🦀 Krab — Message Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../core/config.js";
import { Agent } from "../core/agent.js";

export const messageCommand = new Command("message")
  .description("Send messages via CLI")
  .alias("msg")
  .addCommand(
    new Command("send")
      .description("Send a message to a channel")
      .argument("<channel>", "Channel to send to (telegram, discord, slack)")
      .argument("<recipient>", "Recipient ID or username")
      .argument("<message>", "Message to send")
      .option("--file <path>", "Attach a file")
      .action(async (channel, recipient, message, options) => {
        try {
          console.log(pc.dim(`\nSending message to ${recipient} via ${channel}...`));
          
          // This would integrate with channel system
          console.log(pc.yellow("\n⚠️  Direct message sending requires channel integration"));
          console.log(pc.dim("\nUse the channel's native API or webhook instead."));
          console.log(pc.dim(`Example: Send via ${channel} API directly\n`));
          
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("broadcast")
      .description("Broadcast message to multiple recipients")
      .argument("<channel>", "Channel to broadcast on")
      .argument("<message>", "Message to broadcast")
      .option("--recipients <list>", "Comma-separated recipient list")
      .action(async (channel, message, options) => {
        try {
          if (!options.recipients) {
            console.log(pc.red("\n✗ Error: --recipients required\n"));
            process.exit(1);
          }

          const recipients = options.recipients.split(",").map((r: string) => r.trim());
          
          console.log(pc.dim(`\nBroadcasting to ${recipients.length} recipients via ${channel}...`));
          console.log(pc.yellow("\n⚠️  Broadcasting requires channel integration\n"));
          
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("ai")
      .description("Send message and get AI response")
      .argument("<message>", "Message to send to AI")
      .option("--agent <agent-id>", "Use specific agent")
      .option("--no-stream", "Don't stream response")
      .action(async (message, options) => {
        try {
          const config = loadConfig();
          const agent = new Agent(config);

          console.log(pc.dim("\n🤔 Thinking...\n"));
          
          const response = await agent.chat(message);
          
          console.log(pc.green("🦀 Krab: ") + response + "\n");
        } catch (err: any) {
          console.error(pc.red(`Error: ${err.message}`));
          process.exit(1);
        }
      })
  );
