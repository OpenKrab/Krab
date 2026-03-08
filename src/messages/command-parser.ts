import type { MessageCommandPolicy } from "../core/types.js";
import type { NormalizedMessageContext } from "./types.js";

export function detectCommand(content: string, policy: MessageCommandPolicy): {
  isCommand: boolean;
  commandName?: string;
  commandArgs: string[];
} {
  const prefix = policy.prefix ?? "/";
  const trimmed = content.trim();
  if (!policy.enabled || !trimmed.startsWith(prefix)) {
    return { isCommand: false, commandArgs: [] };
  }

  const withoutPrefix = trimmed.slice(prefix.length).trim();
  if (!withoutPrefix) {
    return { isCommand: false, commandArgs: [] };
  }

  const parts = withoutPrefix.split(/\s+/).filter(Boolean);
  const commandName = parts[0]?.toLowerCase();
  const commandArgs = parts.slice(1);

  if (policy.allow && policy.allow.length > 0 && !policy.allow.includes(commandName)) {
    return { isCommand: false, commandArgs: [] };
  }

  if (policy.deny?.includes(commandName)) {
    return { isCommand: false, commandArgs: [] };
  }

  return { isCommand: true, commandName, commandArgs };
}

export function isOwnerOnlyCommand(context: NormalizedMessageContext, policy: MessageCommandPolicy): boolean {
  return !!context.commandName && !!policy.ownerOnly?.includes(context.commandName);
}
