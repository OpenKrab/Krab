// ============================================================
// 🦀 Krab — Message Actions
// ============================================================
import { z } from "zod";
import { logger } from "../utils/logger.js";
import type { BaseChannel, MessageReactions } from "./base.js";

// ── Action Names ─────────────────────────────────────────────────
export const MessageActionNames = {
  SEND: "send",
  SEND_REPLY: "send_reply",
  SEND_POLL: "send_poll",
  SEND_INTERACTIVE: "send_interactive",
  ADD_REACTION: "add_reaction",
  REMOVE_REACTION: "remove_reaction",
  GET_REACTIONS: "get_reactions",
  EDIT_MESSAGE: "edit_message",
  UNSEND_MESSAGE: "unsend_message",
  SEND_TYPING: "send_typing",
  SEND_VOICE: "send_voice",
} as const;

export type MessageActionName = typeof MessageActionNames[keyof typeof MessageActionNames];

// ── Action Schemas ───────────────────────────────────────────────
export const SendActionSchema = z.object({
  to: z.string(),
  text: z.string().optional(),
  media: z
    .object({
      type: z.enum(["image", "audio", "video", "file"]),
      url: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
});

export const SendReplyActionSchema = z.object({
  to: z.string(),
  replyTo: z.string(),
  text: z.string().optional(),
});

export const SendPollActionSchema = z.object({
  to: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(10),
  allowsMultipleAnswers: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
});

export const SendInteractiveActionSchema = z.object({
  to: z.string(),
  text: z.string().optional(),
  interactive: z.object({
    type: z.enum(["buttons", "carousel", "list"]),
    title: z.string().optional(),
    content: z.string().optional(),
    buttons: z
      .array(
        z.object({
          id: z.string(),
          text: z.string(),
          style: z.enum(["primary", "secondary", "danger", "default"]).optional(),
          url: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export const ReactionActionSchema = z.object({
  messageId: z.string(),
  emoji: z.string(),
  channelId: z.string(),
});

export const EditMessageActionSchema = z.object({
  messageId: z.string(),
  newContent: z.string(),
  channelId: z.string(),
});

export const UnsendMessageActionSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
});

// ── Action Result Types ──────────────────────────────────────────
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SendResult {
  messageId: string;
  timestamp: Date;
}

export interface PollResult {
  pollId: string;
  messageId: string;
}

export interface ReactionResult {
  success: boolean;
  emoji: string;
  totalCount?: number;
}

// ── Message Action Handler ────────────────────────────────────────
export class MessageActionHandler {
  private channel: BaseChannel;

  constructor(channel: BaseChannel) {
    this.channel = channel;
  }

  async handleAction(
    action: MessageActionName,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    logger.debug(`[MessageActionHandler] Handling action: ${action}`);

    try {
      switch (action) {
        case MessageActionNames.SEND:
          return await this.handleSend(params);

        case MessageActionNames.SEND_REPLY:
          return await this.handleSendReply(params);

        case MessageActionNames.SEND_POLL:
          return await this.handleSendPoll(params);

        case MessageActionNames.SEND_INTERACTIVE:
          return await this.handleSendInteractive(params);

        case MessageActionNames.ADD_REACTION:
          return await this.handleAddReaction(params);

        case MessageActionNames.REMOVE_REACTION:
          return await this.handleRemoveReaction(params);

        case MessageActionNames.GET_REACTIONS:
          return await this.handleGetReactions(params);

        case MessageActionNames.EDIT_MESSAGE:
          return await this.handleEditMessage(params);

        case MessageActionNames.UNSEND_MESSAGE:
          return await this.handleUnsendMessage(params);

        case MessageActionNames.SEND_TYPING:
          return await this.handleSendTyping(params);

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      logger.error(`[MessageActionHandler] Action ${action} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  private async handleSend(params: Record<string, unknown>): Promise<ActionResult<SendResult>> {
    const parsed = SendActionSchema.parse(params);
    
    if (parsed.media) {
      if (parsed.media.type === "image" && typeof (this.channel as any).sendImage === "function") {
        await (this.channel as any).sendImage(parsed.media.url!, "", parsed.media.caption, parsed.to);
      } else {
        await this.channel.sendFile(parsed.media.url!, "", parsed.to);
      }
    }
    
    if (parsed.text) {
      await this.channel.sendMessage(parsed.text, parsed.to);
    }

    return {
      success: true,
      data: { messageId: `msg_${Date.now()}`, timestamp: new Date() },
    };
  }

  private async handleSendReply(params: Record<string, unknown>): Promise<ActionResult<SendResult>> {
    const parsed = SendReplyActionSchema.parse(params);
    
    if (typeof this.channel.sendReply === "function") {
      await this.channel.sendReply(parsed.text || "", parsed.replyTo, parsed.to);
    } else {
      await this.channel.sendMessage(parsed.text || "", parsed.to);
    }

    return {
      success: true,
      data: { messageId: `msg_${Date.now()}`, timestamp: new Date() },
    };
  }

  private async handleSendPoll(params: Record<string, unknown>): Promise<ActionResult<PollResult>> {
    const parsed = SendPollActionSchema.parse(params);

    if (typeof this.channel.sendPoll !== "function") {
      return { success: false, error: "Channel does not support polls" };
    }

    const pollId = await this.channel.sendPoll!(
      parsed.question,
      parsed.options,
      parsed.to,
      { allowsMultipleAnswers: parsed.allowsMultipleAnswers, isAnonymous: parsed.isAnonymous }
    );

    return {
      success: true,
      data: { pollId, messageId: pollId },
    };
  }

  private async handleSendInteractive(params: Record<string, unknown>): Promise<ActionResult> {
    const parsed = SendInteractiveActionSchema.parse(params);

    if (typeof this.channel.sendInteractive !== "function") {
      return { success: false, error: "Channel does not support interactive messages" };
    }

    await this.channel.sendInteractive!(
      parsed.text || "",
      {
        type: parsed.interactive.type as any,
        title: parsed.interactive.title,
        content: parsed.interactive.content,
        buttonRows: parsed.interactive.buttons ? [{ buttons: parsed.interactive.buttons as any }] : undefined,
      },
      parsed.to
    );

    return { success: true };
  }

  private async handleAddReaction(params: Record<string, unknown>): Promise<ActionResult<ReactionResult>> {
    const parsed = ReactionActionSchema.parse(params);

    if (typeof this.channel.addReaction !== "function") {
      return { success: false, error: "Channel does not support reactions" };
    }

    await this.channel.addReaction!(parsed.messageId, parsed.emoji, parsed.channelId);

    return { success: true, data: { success: true, emoji: parsed.emoji } };
  }

  private async handleRemoveReaction(params: Record<string, unknown>): Promise<ActionResult> {
    const parsed = ReactionActionSchema.parse(params);

    if (typeof this.channel.removeReaction !== "function") {
      return { success: false, error: "Channel does not support reactions" };
    }

    await this.channel.removeReaction!(parsed.messageId, parsed.emoji, parsed.channelId);

    return { success: true };
  }

  private async handleGetReactions(params: Record<string, unknown>): Promise<ActionResult<MessageReactions>> {
    const parsed = ReactionActionSchema.parse(params);

    if (typeof this.channel.getReactions !== "function") {
      return { success: false, error: "Channel does not support reactions" };
    }

    const reactions = await this.channel.getReactions!(parsed.messageId, parsed.channelId);

    return { success: true, data: reactions };
  }

  private async handleEditMessage(params: Record<string, unknown>): Promise<ActionResult> {
    const parsed = EditMessageActionSchema.parse(params);

    if (typeof this.channel.editMessage !== "function") {
      return { success: false, error: "Channel does not support message editing" };
    }

    await this.channel.editMessage!(parsed.messageId, parsed.newContent, parsed.channelId);

    return { success: true };
  }

  private async handleUnsendMessage(params: Record<string, unknown>): Promise<ActionResult> {
    const parsed = UnsendMessageActionSchema.parse(params);

    if (typeof this.channel.unsendMessage !== "function") {
      return { success: false, error: "Channel does not support message deletion" };
    }

    await this.channel.unsendMessage!(parsed.messageId, parsed.channelId);

    return { success: true };
  }

  private async handleSendTyping(params: Record<string, unknown>): Promise<ActionResult> {
    const { channelId, durationMs } = params as { channelId?: string; durationMs?: number };

    if (typeof (this.channel as any).sendTypingIndicator === "function") {
      await (this.channel as any).sendTypingIndicator(channelId, durationMs || 3000);
    }

    return { success: true };
  }
}
