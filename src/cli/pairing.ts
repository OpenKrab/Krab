// ============================================================
// 🦀 Krab — Pairing Command (DM Access Control)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";

const PAIRING_FILE = join(homedir(), ".krab", "pairing.json");

interface PairingRequest {
  id: string;
  code: string;
  channel: string;
  accountId?: string;
  senderId: string;
  senderName: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  approvedAt?: string;
}

interface PairingStore {
  requests: PairingRequest[];
  approvedPairs: Array<{
    channel: string;
    senderId: string;
    approvedAt: string;
  }>;
}

function loadPairingStore(): PairingStore {
  if (!fs.existsSync(PAIRING_FILE)) {
    return { requests: [], approvedPairs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PAIRING_FILE, "utf-8"));
  } catch {
    return { requests: [], approvedPairs: [] };
  }
}

function savePairingStore(store: PairingStore) {
  const dir = join(homedir(), ".krab");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PAIRING_FILE, JSON.stringify(store, null, 2));
}

function generatePairingCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export const pairingCommand = new Command("pairing")
  .description("Approve or inspect DM pairing requests")
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List pending pairing requests")
      .argument("[channel]", "Channel name (e.g., telegram, discord)")
      .option("-c, --channel <channel>", "Channel name")
      .option("-a, --account <accountId>", "Account ID for multi-account channels")
      .option("--json", "Output as JSON")
      .action((channelArg, options) => {
        const channel = channelArg || options.channel;
        const store = loadPairingStore();

        let requests = store.requests.filter((r) => r.status === "pending");

        if (channel) {
          requests = requests.filter((r) => r.channel === channel);
        }

        if (options.account) {
          requests = requests.filter((r) => r.accountId === options.account);
        }

        if (options.json) {
          console.log(JSON.stringify(requests, null, 2));
          return;
        }

        if (requests.length === 0) {
          console.log(pc.green("\n✓ No pending pairing requests\n"));
          return;
        }

        console.log(pc.bold(`\n🔐 Pending Pairing Requests (${requests.length})\n`));

        for (const req of requests) {
          console.log(`${pc.cyan("Code:")} ${pc.bold(req.code)}`);
          console.log(`  Channel: ${req.channel}${req.accountId ? ` (${req.accountId})` : ""}`);
          console.log(`  From: ${req.senderName} (${req.senderId})`);
          console.log(`  Created: ${formatDate(req.createdAt)}`);
          console.log();
          console.log(pc.dim(`  Run: krab pairing approve ${req.code}`));
          console.log();
        }
      })
  )
  .addCommand(
    new Command("approve")
      .alias("a")
      .description("Approve a pairing request")
      .argument("<code>", "Pairing code to approve")
      .option("-c, --channel <channel>", "Channel name")
      .option("-a, --account <accountId>", "Account ID")
      .option("-n, --notify", "Notify user of approval")
      .action((code, options) => {
        const store = loadPairingStore();

        let request = store.requests.find(
          (r) => r.code.toUpperCase() === code.toUpperCase() && r.status === "pending"
        );

        if (!request && options.channel) {
          request = store.requests.find(
            (r) =>
              r.channel === options.channel &&
              r.status === "pending" &&
              (options.account ? r.accountId === options.account : true)
          );
        }

        if (!request) {
          console.log(pc.red(`\n✗ No pending request with code: ${code}\n`));
          console.log(pc.dim("Run 'krab pairing list' to see pending requests"));
          process.exit(1);
        }

        request.status = "approved";
        request.approvedAt = new Date().toISOString();

        store.approvedPairs.push({
          channel: request.channel,
          senderId: request.senderId,
          approvedAt: request.approvedAt,
        });

        savePairingStore(store);

        console.log(pc.green(`\n✓ Approved pairing request`));
        console.log(`  Code: ${request.code}`);
        console.log(`  User: ${request.senderName}`);
        console.log(`  Channel: ${request.channel}`);

        if (options.notify) {
          console.log(pc.dim("\n  (User will be notified)"));
        }
        console.log();
      })
  )
  .addCommand(
    new Command("deny")
      .alias("d")
      .description("Deny a pairing request")
      .argument("<code>", "Pairing code to deny")
      .action((code) => {
        const store = loadPairingStore();

        const request = store.requests.find(
          (r) => r.code.toUpperCase() === code.toUpperCase() && r.status === "pending"
        );

        if (!request) {
          console.log(pc.red(`\n✗ No pending request with code: ${code}\n`));
          process.exit(1);
        }

        request.status = "denied";
        savePairingStore(store);

        console.log(pc.yellow(`\n✗ Denied pairing request: ${code}\n`));
      })
  )
  .addCommand(
    new Command("history")
      .alias("h")
      .description("Show pairing history")
      .option("--json", "Output as JSON")
      .action((options) => {
        const store = loadPairingStore();

        const allRequests = [...store.requests].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (options.json) {
          console.log(JSON.stringify(allRequests, null, 2));
          return;
        }

        if (allRequests.length === 0) {
          console.log(pc.dim("\nNo pairing history\n"));
          return;
        }

        console.log(pc.bold(`\n📋 Pairing History (${allRequests.length})\n`));

        for (const req of allRequests.slice(0, 20)) {
          const statusIcon =
            req.status === "approved"
              ? pc.green("✓")
              : req.status === "denied"
              ? pc.red("✗")
              : pc.yellow("⏳");

          console.log(`${statusIcon} ${req.code} - ${req.senderName}`);
          console.log(`   ${req.channel} | ${formatDate(req.createdAt)}`);
        }
        console.log();
      })
  )
  .addCommand(
    new Command("generate")
      .description("Generate a pairing code (for testing)")
      .option("-c, --channel <channel>", "Channel name", "telegram")
      .option("--sender <id>", "Sender ID", "test-user")
      .option("--name <name>", "Sender name", "Test User")
      .action((options) => {
        const store = loadPairingStore();
        const code = generatePairingCode();

        const request: PairingRequest = {
          id: randomBytes(8).toString("hex"),
          code,
          channel: options.channel,
          senderId: options.sender,
          senderName: options.name,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        store.requests.push(request);
        savePairingStore(store);

        console.log(pc.bold("\n🔐 Test Pairing Code Generated\n"));
        console.log(`Code: ${pc.bold(pc.cyan(code))}`);
        console.log(`Channel: ${options.channel}`);
        console.log(`Sender: ${options.name} (${options.sender})`);
        console.log();
        console.log(pc.dim(`To approve: krab pairing approve ${code}`));
        console.log();
      })
  );

// Export functions for use in channel handlers
export { loadPairingStore, savePairingStore, generatePairingCode };
