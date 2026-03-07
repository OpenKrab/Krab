export interface OutboundMedia {
  url: string;
  caption?: string;
  filename?: string;
  kind: "image" | "audio" | "video" | "file";
}

export interface StructuredChannelResponse {
  text: string;
  media: OutboundMedia[];
}

export function parseStructuredResponse(
  text: string,
  classifyMediaUrl: (url: string) => OutboundMedia["kind"],
): StructuredChannelResponse | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const mediaSources = Array.isArray((parsed as any).media)
      ? (parsed as any).media
      : Array.isArray((parsed as any).attachments)
        ? (parsed as any).attachments
        : [];

    const media = mediaSources
      .map((item: any) => {
        const url =
          item?.url ||
          item?.imageUrl ||
          item?.audioUrl ||
          item?.videoUrl ||
          item?.fileUrl;
        if (!url || typeof url !== "string") {
          return null;
        }

        const explicitKind = item?.kind || item?.type;
        const kind =
          explicitKind &&
          ["image", "audio", "video", "file"].includes(explicitKind)
            ? explicitKind
            : classifyMediaUrl(url);

        return {
          url,
          caption: typeof item?.caption === "string" ? item.caption : undefined,
          filename:
            typeof item?.filename === "string" ? item.filename : undefined,
          kind,
        } satisfies OutboundMedia;
      })
      .filter(Boolean) as OutboundMedia[];

    if (
      media.length === 0 &&
      typeof (parsed as any).text !== "string" &&
      typeof (parsed as any).message !== "string"
    ) {
      return null;
    }

    return {
      text: String((parsed as any).text || (parsed as any).message || ""),
      media,
    };
  } catch {
    return null;
  }
}

export function extractMediaUrls(
  text: string,
  classifyMediaUrl: (url: string) => OutboundMedia["kind"],
  looksLikeMediaUrl: (url: string) => boolean,
): OutboundMedia[] {
  const matches: OutboundMedia[] = [];
  const markdownMediaRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const rawUrlRegex = /https?:\/\/[^\s)]+/g;

  for (const match of text.matchAll(markdownMediaRegex)) {
    matches.push({
      caption: match[1] || undefined,
      url: match[2],
      kind: classifyMediaUrl(match[2]),
    });
  }

  for (const match of text.matchAll(rawUrlRegex)) {
    const url = match[0];
    if (!matches.some((item) => item.url === url) && looksLikeMediaUrl(url)) {
      matches.push({
        url,
        kind: classifyMediaUrl(url),
      });
    }
  }

  return matches;
}

export function stripMediaMarkup(
  text: string,
  looksLikeMediaUrl: (url: string) => boolean,
): string {
  return text
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "")
    .replace(/https?:\/\/[^\s)]+/g, (url) => (looksLikeMediaUrl(url) ? "" : url))
    .replace(/\n{3,}/g, "\n\n");
}
