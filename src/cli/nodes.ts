// ============================================================
// Krab - Nodes Command (Device Node Management)
// ============================================================
import { Command } from "commander";
import pc from "picocolors";

interface NodeDevice {
  id: string;
  name: string;
  platform: "macos" | "ios" | "android" | "linux" | "windows";
  status: "connected" | "disconnected" | "pending";
  lastSeen: Date;
  capabilities: string[];
}

const nodesRegistry: Map<string, NodeDevice> = new Map();

export const nodesCommand = new Command("nodes")
  .description("Manage device nodes (macOS/iOS/Android)")
  
  .addCommand(
    new Command("list")
      .alias("ls")
      .description("List all connected nodes")
      .option("--connected", "Show only connected nodes")
      .option("--json", "Output as JSON")
      .action((options) => {
        const nodes = Array.from(nodesRegistry.values());
        
        if (options.connected) {
          const connected = nodes.filter(n => n.status === "connected");
          
          if (options.json) {
            console.log(JSON.stringify(connected, null, 2));
            return;
          }
          
          console.log(pc.bold("\nConnected Nodes (" + connected.length + ")\n"));
          for (const node of connected) {
            console.log("  " + pc.cyan(node.id) + " - " + node.name);
            console.log("    Platform: " + node.platform);
            console.log("    Last seen: " + pc.dim(node.lastSeen.toLocaleString()));
            console.log("    Capabilities: " + node.capabilities.join(", "));
            console.log();
          }
          return;
        }
        
        if (options.json) {
          console.log(JSON.stringify(nodes, null, 2));
          return;
        }
        
        console.log(pc.bold("\nDevice Nodes (" + nodes.length + ")\n"));
        
        if (nodes.length === 0) {
          console.log(pc.dim("No nodes registered"));
          console.log(pc.dim("\nTo pair a device:"));
          console.log(pc.cyan("  1. Install Krab on your device"));
          console.log(pc.cyan("  2. Run 'krab pair' on the device"));
          console.log(pc.cyan("  3. Approve the pairing request here\n"));
          return;
        }
        
        for (const node of nodes) {
          const statusColor = node.status === "connected" ? pc.green :
                             node.status === "pending" ? pc.yellow : pc.red;
          
          console.log("  " + pc.cyan(node.id) + " - " + node.name);
          console.log("    Platform: " + node.platform);
          console.log("    Status: " + statusColor(node.status));
          console.log("    Last seen: " + pc.dim(node.lastSeen.toLocaleString()));
          console.log("    Capabilities: " + pc.dim(node.capabilities.join(", ")));
          console.log();
        }
      })
  )
  
  .addCommand(
    new Command("status")
      .description("Show overall nodes status")
      .option("--json", "Output as JSON")
      .action((options) => {
        const nodes = Array.from(nodesRegistry.values());
        const connected = nodes.filter(n => n.status === "connected");
        const pending = nodes.filter(n => n.status === "pending");
        const disconnected = nodes.filter(n => n.status === "disconnected");
        
        if (options.json) {
          console.log(JSON.stringify({
            total: nodes.length,
            connected: connected.length,
            pending: pending.length,
            disconnected: disconnected.length
          }, null, 2));
          return;
        }
        
        console.log(pc.bold("\nNodes Status\n"));
        console.log("  Total:     " + nodes.length);
        console.log("  Connected:  " + pc.green(connected.length));
        console.log("  Pending:    " + pc.yellow(pending.length));
        console.log("  Offline:    " + pc.red(disconnected.length));
        console.log();
      })
  )
  
  .addCommand(
    new Command("describe")
      .description("Show detailed node information")
      .option("--node <id>", "Node ID or name")
      .action((options) => {
        if (!options.node) {
          console.error(pc.red("\nPlease specify a node ID with --node\n"));
          process.exit(1);
        }
        
        const node = nodesRegistry.get(options.node) || 
                     Array.from(nodesRegistry.values()).find(n => n.name === options.node);
        
        if (!node) {
          console.error(pc.red("\nNode '" + options.node + "' not found\n"));
          process.exit(1);
        }
        
        console.log(pc.bold("\nNode: " + node.name + "\n"));
        console.log("  ID:         " + pc.cyan(node.id));
        console.log("  Platform:   " + node.platform);
        console.log("  Status:     " + (node.status === "connected" ? pc.green(node.status) : pc.red(node.status)));
        console.log("  Last Seen:  " + node.lastSeen.toLocaleString());
        
        console.log(pc.bold("\n  Capabilities:\n"));
        for (const cap of node.capabilities) {
          console.log("    * " + cap);
        }
        console.log();
      })
  )
  
  .addCommand(
    new Command("invoke")
      .description("Invoke a command on a node")
      .option("--node <id>", "Node ID or name (required)")
      .option("--command <cmd>", "Command to invoke (required)")
      .option("--params <json>", "JSON parameters for the command")
      .action(async (options) => {
        if (!options.node) {
          console.error(pc.red("\nPlease specify a node with --node\n"));
          process.exit(1);
        }
        
        if (!options.command) {
          console.error(pc.red("\nPlease specify a command with --command\n"));
          process.exit(1);
        }
        
        const node = nodesRegistry.get(options.node) || 
                     Array.from(nodesRegistry.values()).find(n => n.name === options.node);
        
        if (!node) {
          console.error(pc.red("\nNode '" + options.node + "' not found\n"));
          process.exit(1);
        }
        
        if (node.status !== "connected") {
          console.error(pc.red("\nNode '" + options.node + "' is not connected\n"));
          process.exit(1);
        }
        
        console.log(pc.dim("\nInvoking " + options.command + " on " + node.name + "...\n"));
        
        console.log(pc.yellow("Node commands require gateway connection\n"));
        console.log(pc.dim("This feature requires:"));
        console.log(pc.dim("  1. Gateway to be running"));
        console.log(pc.dim("  2. Node to be paired and connected\n"));
      })
  )
  
  .addCommand(
    new Command("camera")
      .description("Camera operations on node devices")
      .addCommand(
        new Command("list")
          .description("List available cameras on node")
          .option("--node <id>", "Node ID or name")
          .action(() => {
            console.log(pc.bold("\nAvailable Cameras\n"));
            console.log(pc.dim("No cameras available (node not connected)\n"));
            console.log(pc.dim("Connect a node to access camera features:\n"));
            console.log(pc.cyan("  krab nodes list --connected\n"));
          })
      )
      .addCommand(
        new Command("snap")
          .description("Take a photo with node camera")
          .option("--node <id>", "Node ID or name")
          .option("--facing <front|back>", "Camera facing", "back")
          .action(() => {
            console.log(pc.bold("\nCamera Snapshot\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
      .addCommand(
        new Command("clip")
          .description("Record a video clip with node camera")
          .option("--node <id>", "Node ID or name")
          .option("--duration <ms|10s|1m>", "Clip duration")
          .action(() => {
            console.log(pc.bold("\nCamera Clip\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
  )
  
  .addCommand(
    new Command("canvas")
      .description("Canvas operations on node devices")
      .addCommand(
        new Command("snapshot")
          .description("Get canvas screenshot")
          .option("--node <id>", "Node ID or name")
          .action(() => {
            console.log(pc.bold("\nCanvas Snapshot\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
      .addCommand(
        new Command("present")
          .description("Present content on canvas")
          .option("--node <id>", "Node ID or name")
          .option("--target <urlOrPath>", "URL or file path")
          .action(() => {
            console.log(pc.bold("\nCanvas Present\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
      .addCommand(
        new Command("hide")
          .description("Hide canvas")
          .option("--node <id>", "Node ID or name")
          .action(() => {
            console.log(pc.bold("\nCanvas Hide\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
      .addCommand(
        new Command("navigate")
          .description("Navigate canvas to URL")
          .argument("<url>", "URL to navigate to")
          .option("--node <id>", "Node ID or name")
          .action(() => {
            console.log(pc.bold("\nCanvas Navigate\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
      .addCommand(
        new Command("eval")
          .description("Execute JavaScript on canvas")
          .argument("[code]", "JavaScript code to execute")
          .option("--node <id>", "Node ID or name")
          .option("--js <code>", "JavaScript code")
          .action(() => {
            console.log(pc.bold("\nCanvas Eval\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
      .addCommand(
        new Command("a2ui")
          .description("Send A2UI commands to canvas")
          .addCommand(
            new Command("push")
              .description("Push A2UI elements to canvas")
              .option("--node <id>", "Node ID or name")
              .option("--jsonl <path>", "Path to JSONL file")
              .action(() => {
                console.log(pc.bold("\nA2UI Push\n"));
                console.log(pc.yellow("Node not connected\n"));
              })
          )
          .addCommand(
            new Command("reset")
              .description("Reset canvas")
              .option("--node <id>", "Node ID or name")
              .action(() => {
                console.log(pc.bold("\nA2UI Reset\n"));
                console.log(pc.yellow("Node not connected\n"));
              })
          )
      )
  )
  
  .addCommand(
    new Command("screen")
      .description("Screen recording on node devices")
      .addCommand(
        new Command("record")
          .description("Record screen")
          .option("--node <id>", "Node ID or name")
          .option("--duration <ms|10s>", "Recording duration")
          .option("--fps <n>", "Frames per second", "30")
          .action(() => {
            console.log(pc.bold("\nScreen Record\n"));
            console.log(pc.yellow("Node not connected\n"));
          })
      )
  )
  
  .addCommand(
    new Command("location")
      .description("Get location from node device")
      .addCommand(
        new Command("get")
          .description("Get current location")
          .option("--node <id>", "Node ID or name")
          .option("--accuracy <coarse|balanced|precise>", "Accuracy level", "balanced")
          .action(() => {
            console.log(pc.bold("\nLocation\n"));
            console.log(pc.yellow("Node not connected\n"));
            console.log(pc.dim("This command requires a connected iOS or Android node\n"));
          })
      )
  )
  
  .addCommand(
    new Command("notify")
      .description("Send notification to node")
      .option("--node <id>", "Node ID or name")
      .option("--title <text>", "Notification title")
      .option("--body <text>", "Notification body")
      .action(() => {
        console.log(pc.bold("\nNotify\n"));
        console.log(pc.yellow("Node not connected\n"));
      })
  )
  
  .addCommand(
    new Command("pending")
      .description("List pending pairing requests")
      .action(() => {
        const pending = Array.from(nodesRegistry.values()).filter(n => n.status === "pending");
        
        if (pending.length === 0) {
          console.log(pc.dim("\nNo pending pairing requests\n"));
          return;
        }
        
        console.log(pc.bold("\nPending Requests (" + pending.length + ")\n"));
        for (const node of pending) {
          console.log("  " + pc.cyan(node.id) + " - " + node.name);
          console.log("    Platform: " + node.platform);
          console.log("    Requested: " + pc.dim(node.lastSeen.toLocaleString()));
          console.log();
        }
      })
  )
  
  .addCommand(
    new Command("approve")
      .description("Approve a pending node pairing")
      .argument("<requestId>", "Request ID to approve")
      .action((requestId) => {
        console.log(pc.green("\nApproved node pairing: " + requestId + "\n"));
      })
  )
  
  .addCommand(
    new Command("reject")
      .description("Reject a pending node pairing")
      .argument("<requestId>", "Request ID to reject")
      .action((requestId) => {
        console.log(pc.green("\nRejected node pairing: " + requestId + "\n"));
      })
  )
  
  .addCommand(
    new Command("rename")
      .description("Rename a node")
      .option("--node <id>", "Node ID or name")
      .option("--name <displayName>", "New display name")
      .action((options) => {
        if (!options.node) {
          console.error(pc.red("\nPlease specify a node with --node\n"));
          process.exit(1);
        }
        
        if (!options.name) {
          console.error(pc.red("\nPlease specify a new name with --name\n"));
          process.exit(1);
        }
        
        const node = nodesRegistry.get(options.node);
        if (!node) {
          console.error(pc.red("\nNode '" + options.node + "' not found\n"));
          process.exit(1);
        }
        
        node.name = options.name;
        console.log(pc.green("\nRenamed node to '" + options.name + "'\n"));
      })
  )
  
  .addCommand(
    new Command("remove")
      .description("Remove a node from registry")
      .argument("<nodeId>", "Node ID to remove")
      .action((nodeId) => {
        if (nodesRegistry.has(nodeId)) {
          nodesRegistry.delete(nodeId);
          console.log(pc.green("\nRemoved node: " + nodeId + "\n"));
        } else {
          console.error(pc.red("\nNode '" + nodeId + "' not found\n"));
          process.exit(1);
        }
      })
  );
