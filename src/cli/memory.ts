import { Command } from "commander";
import pc from "picocolors";
import { memoryManager } from "../memory/manager.js";
import { printBanner, printInfo, printKeyValue, printSection, printWarning } from "../tui/style.js";

export const memoryCommand = new Command("memory")
  .description("Inspect and search memory state")
  .addCommand(
    new Command("status")
      .description("Show memory indexing and retrieval status")
      .option("--json", "Output JSON")
      .action((options) => {
        const status = memoryManager.getStatus();
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }

        printBanner("Memory Search Surface");
        printSection("Memory Status");
        printKeyValue("Workspace", status.workspaceDir);
        printKeyValue("Memory Dir", status.memoryDir);
        printKeyValue("Memory Files", String(status.files));
        printKeyValue("Conversations", String(status.conversations));
        printKeyValue("Vector Entries", String(status.vectorEntries));
        printKeyValue("Vector Conversations", String(status.vectorConversations));
        printKeyValue("Semantic Retrieval", status.semanticAvailable ? "Available" : "Limited");
        console.log("");
      }),
  )
  .addCommand(
    new Command("search")
      .description("Search hybrid memory sources")
      .argument("<query>", "Query to search for")
      .option("--limit <n>", "Maximum number of results", "10")
      .option("--json", "Output JSON")
      .action(async (query, options) => {
        const limit = Number.parseInt(String(options.limit), 10) || 10;
        const results = await memoryManager.getHybridMemoryResultsAsync(query, {
          limit,
          conversationLimit: limit,
        });

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        printBanner("Memory Search Surface");
        printSection(`Hybrid Retrieval // ${query}`);

        if (results.length === 0) {
          printWarning("No memory matches found.");
          console.log("");
          return;
        }

        for (const entry of results) {
          console.log(`${pc.bold(entry.id)} ${pc.dim(`[${entry.source}]`)} ${pc.yellow(`${entry.score}`)}`);
          console.log(`  ${entry.preview}`);
          console.log(`  ${pc.dim(entry.timestamp)}`);
          console.log("");
        }
      }),
  )
  .addCommand(
    new Command("files")
      .description("List indexed memory files")
      .option("--json", "Output JSON")
      .action((options) => {
        const files = memoryManager.getMemoryFiles().map((entry) => ({
          file: entry.file,
          type: entry.type,
          timestamp: entry.timestamp.toISOString(),
          size: entry.content.length,
        }));

        if (options.json) {
          console.log(JSON.stringify(files, null, 2));
          return;
        }

        printBanner("Memory Search Surface");
        printSection("Indexed Memory Files");

        if (files.length === 0) {
          printWarning("No memory files found.");
          console.log("");
          return;
        }

        for (const file of files) {
          printKeyValue(file.file, `${file.type} // ${file.size} bytes // ${file.timestamp}`);
        }
        console.log("");
        printInfo("Use `krab memory search <query>` to search across memory and conversation history.");
      }),
  );
