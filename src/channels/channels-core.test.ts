import { describe, expect, it } from "vitest";
import { checkDmPolicy, checkGroupPolicy } from "./policy.js";
import { buildAgentInput, getChannelConversationId, getChannelReplyTarget } from "./session.js";
import { extractMediaUrls, parseStructuredResponse, stripMediaMarkup } from "./outbound.js";
import type { BaseMessage, ChannelConfig } from "./base.js";

const baseConfig: ChannelConfig = {
  enabled: true,
  dmPolicy: "allowlist",
  groupPolicy: "open",
  allowFrom: ["user-1"],
  groupAllowFrom: ["*"],
  groups: {
    "*": {
      requireMention: false,
    },
  },
};

function createMessage(overrides: Partial<BaseMessage> = {}): BaseMessage {
  return {
    id: "msg-1",
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    sender: { id: "user-1", username: "tester" },
    channel: "telegram",
    content: "hello",
    type: "text",
    metadata: {},
    ...overrides,
  };
}

describe("channel policy helpers", () => {
  it("allows DM messages from allowlisted senders", () => {
    expect(checkDmPolicy(baseConfig, "user-1", () => false)).toBe(true);
    expect(checkDmPolicy(baseConfig, "user-2", () => false)).toBe(false);
  });

  it("enforces group mention gating when configured", () => {
    const config: ChannelConfig = {
      ...baseConfig,
      groups: {
        "*": {
          requireMention: true,
        },
      },
    };

    expect(
      checkGroupPolicy(
        config,
        createMessage({
          metadata: { groupId: "group-1", mentions: ["@krab"] },
        }),
      ),
    ).toBe(true);

    expect(
      checkGroupPolicy(
        config,
        createMessage({
          metadata: { groupId: "group-1", mentions: [] },
        }),
      ),
    ).toBe(false);
  });
});

describe("channel session helpers", () => {
  it("builds conversation ids and reply targets consistently", () => {
    const message = createMessage({
      metadata: { groupId: "group-42" },
    });

    expect(getChannelConversationId("line", message)).toBe("line:group-42");
    expect(getChannelReplyTarget(message)).toBe("group-42");
  });

  it("includes transcription in agent input when present", () => {
    const input = buildAgentInput({
      ...createMessage(),
      transcription: "sawadee",
    } as any);

    expect(input).toContain("hello");
    expect(input).toContain("sawadee");
  });
});

describe("channel outbound helpers", () => {
  const classify = (url: string) =>
    url.endsWith(".png") ? "image" : url.endsWith(".mp3") ? "audio" : "file";
  const looksLike = (url: string) => /\.(png|mp3|pdf)$/i.test(url);

  it("extracts markdown and raw media urls", () => {
    const text =
      'See this ![chart](https://example.com/chart.png) and https://example.com/audio.mp3';
    const media = extractMediaUrls(text, classify as any, looksLike);

    expect(media).toHaveLength(2);
    expect(media[0]?.caption).toBe("chart");
    expect(media[0]?.kind).toBe("image");
    expect(media[1]?.kind).toBe("audio");
  });

  it("parses structured response envelopes", () => {
    const parsed = parseStructuredResponse(
      JSON.stringify({
        text: "done",
        media: [{ url: "https://example.com/report.pdf", type: "file" }],
      }),
      classify as any,
    );

    expect(parsed?.text).toBe("done");
    expect(parsed?.media[0]?.kind).toBe("file");
  });

  it("strips media markup from plain text output", () => {
    const text = stripMediaMarkup(
      "Look ![img](https://example.com/a.png)\nhttps://example.com/a.png\nkeep https://example.com/page",
      looksLike,
    );

    expect(text).toContain("Look");
    expect(text).toContain("https://example.com/page");
    expect(text).not.toContain("a.png");
  });
});
