import type { BaseMessage } from "../channels/base.js";
import { loadConfig } from "../core/config.js";
import type { MessageRuntimeConfig } from "./types.js";

export function getMessageRuntimeConfig(channelName: string, message?: BaseMessage): MessageRuntimeConfig {
  const config = loadConfig();
  const defaults = config.agents?.defaults?.messages;
  const inbound = defaults?.inbound;
  const channelDebounce = inbound?.byChannel?.[channelName];

  return {
    inboundDebounceMs: channelDebounce ?? inbound?.debounceMs ?? 0,
    activation: {
      mode: defaults?.activation?.mode ?? (message?.metadata?.groupId ? "smart" : "always"),
      requireMentionInGroups: defaults?.activation?.requireMentionInGroups ?? false,
      allowRepliesInGroups: defaults?.activation?.allowRepliesInGroups ?? true,
      allowThreads: defaults?.activation?.allowThreads ?? true,
    },
    commands: {
      enabled: defaults?.commands?.enabled ?? true,
      prefix: defaults?.commands?.prefix ?? "/",
      allow: defaults?.commands?.allow ?? [],
      deny: defaults?.commands?.deny ?? [],
      ownerOnly: defaults?.commands?.ownerOnly ?? [],
    },
    queue: {
      mode: defaults?.queue?.mode ?? "followup",
      maxPerSession: defaults?.queue?.maxPerSession ?? 25,
      dropPolicy: defaults?.queue?.dropPolicy ?? "oldest",
    },
    routingDiagnostics: {
      enabled: defaults?.routingDiagnostics?.enabled ?? false,
      includeReasons: defaults?.routingDiagnostics?.includeReasons ?? true,
      maxEntries: defaults?.routingDiagnostics?.maxEntries ?? 200,
    },
  };
}
