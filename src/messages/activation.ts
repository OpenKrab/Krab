import type { MessageActivationPolicy } from "../core/types.js";
import type { ActivationDecision, NormalizedMessageContext } from "./types.js";

export function evaluateActivation(
  context: NormalizedMessageContext,
  policy: MessageActivationPolicy,
): ActivationDecision {
  const mode = policy.mode ?? "smart";

  if (context.isDirectMessage) {
    return { allowed: true, reason: "direct-message" };
  }

  switch (mode) {
    case "always":
      return { allowed: true, reason: "always" };
    case "dm-only":
      return { allowed: false, reason: "dm-only" };
    case "mention":
      return context.hasMention
        ? { allowed: true, reason: "mention" }
        : { allowed: false, reason: "mention-required" };
    case "reply":
      return context.isReply
        ? { allowed: true, reason: "reply" }
        : { allowed: false, reason: "reply-required" };
    case "smart":
    default:
      if (context.isCommand) {
        return { allowed: true, reason: "command" };
      }
      if (context.hasMention) {
        return { allowed: true, reason: "mention" };
      }
      if (context.isReply && policy.allowRepliesInGroups !== false) {
        return { allowed: true, reason: "reply" };
      }
      if (context.threadId && policy.allowThreads !== false) {
        return { allowed: true, reason: "thread" };
      }
      if (policy.requireMentionInGroups) {
        return { allowed: false, reason: "mention-required" };
      }
      return { allowed: false, reason: "smart-filtered" };
  }
}
