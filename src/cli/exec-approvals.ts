// ============================================================
// Krab - Exec Approvals Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";

interface ExecApproval {
  id: string;
  command: string;
  status: "pending" | "approved" | "denied";
  createdAt: Date;
  expiresAt?: Date;
}

const approvalsStore: Map<string, ExecApproval> = new Map();
const allowlist: string[] = [];

export const execApprovalsCommand = new Command("exec-approvals")
  .description("Manage execution approvals for dangerous commands")
  
  // ── Get ─────────────────────────────────────────────────
  .addCommand(
    new Command("get")
      .description("Get current approvals configuration")
      .option("--json", "Output as JSON")
      .action((options) => {
        const approvals = Array.from(approvalsStore.values());
        
        if (options.json) {
          console.log(JSON.stringify({
            approvals: approvals,
            allowlist: allowlist
          }, null, 2));
          return;
        }
        
        console.log(pc.bold("\nExec Approvals Configuration\n"));
        
        console.log(pc.bold("\nAllowlist:\n"));
        if (allowlist.length === 0) {
          console.log(pc.dim("  (empty)"));
        } else {
          for (const pattern of allowlist) {
            console.log("  " + pc.cyan(pattern));
          }
        }
        
        console.log(pc.bold("\nPending Approvals:\n"));
        const pending = approvals.filter(a => a.status === "pending");
        if (pending.length === 0) {
          console.log(pc.dim("  (none)"));
        } else {
          for (const approval of pending) {
            console.log("  " + approval.id);
            console.log("    Command: " + pc.dim(approval.command));
            console.log("    Created: " + pc.dim(approval.createdAt.toLocaleString()));
            if (approval.expiresAt) {
              console.log("    Expires: " + pc.dim(approval.expiresAt.toLocaleString()));
            }
          }
        }
        console.log();
      })
  )
  
  // ── Set ─────────────────────────────────────────────────
  .addCommand(
    new Command("set")
      .description("Set approvals configuration")
      .option("--allow <patterns...>", "Commands to allow without approval")
      .option("--deny <patterns...>", "Commands to deny")
      .option("--require-all", "Require approval for all exec commands")
      .action((options) => {
        console.log(pc.bold("\nExec Approvals Updated\n"));
        
        if (options.allow) {
          console.log(pc.green("Allowlist updated"));
          for (const pattern of options.allow) {
            if (!allowlist.includes(pattern)) {
              allowlist.push(pattern);
            }
          }
        }
        
        console.log(pc.green("\nConfiguration saved\n"));
      })
  )
  
  // ── Allowlist Add ─────────────────────────────────────────────────
  .addCommand(
    new Command("allowlist")
      .description("Manage command allowlist")
      .addCommand(
        new Command("add")
          .description("Add pattern to allowlist")
          .argument("<pattern>", "Command pattern (supports wildcards)")
          .action((pattern) => {
            if (!allowlist.includes(pattern)) {
              allowlist.push(pattern);
              console.log(pc.green("\nAdded to allowlist: " + pattern + "\n"));
            } else {
              console.log(pc.yellow("\nPattern already in allowlist: " + pattern + "\n"));
            }
          })
      )
      .addCommand(
        new Command("remove")
          .description("Remove pattern from allowlist")
          .argument("<pattern>", "Command pattern to remove")
          .action((pattern) => {
            const index = allowlist.indexOf(pattern);
            if (index >= 0) {
              allowlist.splice(index, 1);
              console.log(pc.green("\nRemoved from allowlist: " + pattern + "\n"));
            } else {
              console.error(pc.red("\nPattern not found in allowlist: " + pattern + "\n"));
              process.exit(1);
            }
          })
      )
      .addCommand(
        new Command("list")
          .description("List all allowlist patterns")
          .option("--json", "Output as JSON")
          .action((options) => {
            if (options.json) {
              console.log(JSON.stringify(allowlist, null, 2));
              return;
            }
            
            console.log(pc.bold("\nAllowlist Patterns (" + allowlist.length + ")\n"));
            if (allowlist.length === 0) {
              console.log(pc.dim("  (empty)"));
            } else {
              for (const pattern of allowlist) {
                console.log("  " + pc.cyan(pattern));
              }
            }
            console.log();
          })
      )
      .addCommand(
        new Command("clear")
          .description("Clear all allowlist patterns")
          .option("--yes", "Skip confirmation")
          .action((options) => {
            allowlist.length = 0;
            console.log(pc.green("\nAllowlist cleared\n"));
          })
      )
  )
  
  // ── Pending ─────────────────────────────────────────────────
  .addCommand(
    new Command("pending")
      .description("List pending approval requests")
      .option("--json", "Output as JSON")
      .action((options) => {
        const pending = Array.from(approvalsStore.values())
          .filter(a => a.status === "pending");
        
        if (options.json) {
          console.log(JSON.stringify(pending, null, 2));
          return;
        }
        
        console.log(pc.bold("\nPending Approvals (" + pending.length + ")\n"));
        
        if (pending.length === 0) {
          console.log(pc.dim("  (none)\n"));
          return;
        }
        
        for (const approval of pending) {
          console.log("  " + pc.cyan(approval.id));
          console.log("    Command: " + approval.command);
          console.log("    Created: " + pc.dim(approval.createdAt.toLocaleString()));
          if (approval.expiresAt) {
            console.log("    Expires: " + pc.dim(approval.expiresAt.toLocaleString()));
          }
          console.log();
        }
      })
  )
  
  // ── Approve ─────────────────────────────────────────────────
  .addCommand(
    new Command("approve")
      .description("Approve a pending command")
      .argument("<id>", "Approval request ID")
      .option("--expires <duration>", "Expiration (e.g., 1h, 24h, 7d)")
      .action((id, options) => {
        const approval = approvalsStore.get(id);
        
        if (!approval) {
          // Auto-create approval if not exists
          approvalsStore.set(id, {
            id,
            command: id,
            status: "approved",
            createdAt: new Date()
          });
          console.log(pc.green("\nCommand approved: " + id + "\n"));
          return;
        }
        
        approval.status = "approved";
        console.log(pc.green("\nCommand approved: " + id + "\n"));
      })
  )
  
  // ── Deny ─────────────────────────────────────────────────
  .addCommand(
    new Command("deny")
      .description("Deny a pending command")
      .argument("<id>", "Approval request ID")
      .action((id) => {
        const approval = approvalsStore.get(id);
        
        if (!approval) {
          console.error(pc.red("\nApproval request not found: " + id + "\n"));
          process.exit(1);
        }
        
        approval.status = "denied";
        console.log(pc.red("\nCommand denied: " + id + "\n"));
      })
  )
  
  // ── Revoke ─────────────────────────────────────────────────
  .addCommand(
    new Command("revoke")
      .description("Revoke an approved command")
      .argument("<id>", "Approval ID to revoke")
      .action((id) => {
        const approval = approvalsStore.get(id);
        
        if (!approval) {
          console.error(pc.red("\nApproval not found: " + id + "\n"));
          process.exit(1);
        }
        
        approval.status = "denied";
        console.log(pc.green("\nApproval revoked: " + id + "\n"));
      })
  )
  
  // ── Clear ─────────────────────────────────────────────────
  .addCommand(
    new Command("clear")
      .description("Clear all approvals")
      .option("--pending", "Clear only pending")
      .option("--approved", "Clear only approved")
      .option("--denied", "Clear only denied")
      .option("--yes", "Skip confirmation")
      .action((options) => {
        let cleared = 0;
        
        if (options.pending) {
          for (const [id, approval] of approvalsStore) {
            if (approval.status === "pending") {
              approvalsStore.delete(id);
              cleared++;
            }
          }
        } else if (options.approved) {
          for (const [id, approval] of approvalsStore) {
            if (approval.status === "approved") {
              approvalsStore.delete(id);
              cleared++;
            }
          }
        } else if (options.denied) {
          for (const [id, approval] of approvalsStore) {
            if (approval.status === "denied") {
              approvalsStore.delete(id);
              cleared++;
            }
          }
        } else {
          cleared = approvalsStore.size;
          approvalsStore.clear();
        }
        
        console.log(pc.green("\nCleared " + cleared + " approval(s)\n"));
      })
  );
