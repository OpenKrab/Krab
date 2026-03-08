import type { BaseMessage } from "../channels/base.js";
import type { MessageRuntimeConfig } from "./types.js";
import { detectCommand } from "./command-parser.js";

export function normalizeIncomingMessage(
  message: BaseMessage,
  channelName: string,
  runtime: MessageRuntimeConfig,
): import("./types.js").NormalizedMessageContext {
  const mentions = message.metadata?.mentions ?? [];
  const command = detectCommand(message.content, runtime.commands);
  const isDirectMessage = !message.metadata?.groupId;
  const isReply = !!message.metadata?.replyTo;
  const hasMention = mentions.length > 0 || /@krab\b/i.test(message.content);
  const senderId = message.sender.id;
  const groupId = message.metadata?.groupId;
  const threadId = message.metadata?.threadId;
  const debounceKey = `${channelName}:${senderId}:${groupId ?? "dm"}:${threadId ?? "root"}`;

  return {
    original: message,
    normalizedContent: message.content.trim(),
    commandName: command.commandName,
    commandArgs: command.commandArgs,
    isCommand: command.isCommand,
    isDirectMessage,
    isReply,
    hasMention,
    senderId,
    channelName,
    groupId,
    threadId,
    debounceKey,
  };
}
