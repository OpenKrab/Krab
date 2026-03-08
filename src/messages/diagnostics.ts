import { logger } from "../utils/logger.js";
import type { RoutingDiagnosticEntry } from "./types.js";

const entries: RoutingDiagnosticEntry[] = [];

export function recordRoutingDiagnostic(entry: RoutingDiagnosticEntry, maxEntries = 200): void {
  entries.push(entry);
  while (entries.length > maxEntries) {
    entries.shift();
  }
  logger.debug(`[RoutingDiagnostics] ${entry.reason} (${entry.channelName}/${entry.senderId} -> ${entry.matchedAgentId ?? "unknown"})`);
}

export function getRoutingDiagnostics(): RoutingDiagnosticEntry[] {
  return [...entries];
}

export function clearRoutingDiagnostics(): void {
  entries.length = 0;
}
