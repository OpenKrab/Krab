// ============================================================
// 🦀 Krab — Messaging Targets
// ============================================================
import { logger } from "../utils/logger.js";

export type MessagingTargetKind = "user" | "channel" | "group" | "room";

export interface MessagingTarget {
  kind: MessagingTargetKind;
  id: string;
  raw: string;
  normalized: string;
}

export interface MessagingTargetParseOptions {
  defaultKind?: MessagingTargetKind;
  mentionPatterns?: Record<MessagingTargetKind, RegExp>;
  prefixes?: Record<MessagingTargetKind, string>;
}

export class TargetParser {
  private options: MessagingTargetParseOptions;
  private defaultMentionPattern = /@(\w+)/g;
  private defaultPrefixes: Record<string, string> = {
    user: "U:",
    channel: "C:",
    group: "G:",
    room: "R:",
  };

  constructor(options: MessagingTargetParseOptions = {}) {
    this.options = options;
  }

  parse(raw: string): MessagingTarget | undefined {
    const mentionPatterns = this.options.mentionPatterns || {
      user: this.defaultMentionPattern,
      channel: /#(\w+)/g,
      group: /##(\w+)/g,
    };

    for (const [kind, pattern] of Object.entries(mentionPatterns)) {
      const match = this.parseWithPattern(raw, pattern);
      if (match) {
        return match;
      }
    }

    const prefixes = { ...this.defaultPrefixes, ...this.options.prefixes };
    for (const [prefix, kind] of Object.entries(prefixes)) {
      const parsed = this.parseWithPrefix(raw, prefix);
      if (parsed) {
        return parsed;
      }
    }

    if (this.options.defaultKind) {
      return this.build(raw, this.options.defaultKind, raw);
    }

    return undefined;
  }

  parseUser(input: string): MessagingTarget | undefined {
    const patterns = [
      /U:(\w+)/,
      /@(\w+)/,
      /^(\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return this.build(input, "user", match[1]);
      }
    }

    return this.build(input, "user", input);
  }

  parseChannel(input: string): MessagingTarget | undefined {
    const patterns = [
      /C:(\w+)/,
      /#(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return this.build(input, "channel", match[1]);
      }
    }

    return undefined;
  }

  parseGroup(input: string): MessagingTarget | undefined {
    const patterns = [
      /G:(\w+)/,
      /##(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return this.build(input, "group", match[1]);
      }
    }

    return undefined;
  }

  private parseWithPattern(raw: string, pattern: RegExp): MessagingTarget | undefined {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return this.build(raw, "user", match[1]);
    }
    return undefined;
  }

  private parseWithPrefix(raw: string, prefix: string): MessagingTarget | undefined {
    if (!raw.startsWith(prefix)) return undefined;
    
    const id = raw.slice(prefix.length).trim();
    if (!id) return undefined;

    const kindMap: Record<string, MessagingTargetKind> = {
      "U:": "user",
      "C:": "channel",
      "G:": "group",
      "R:": "room",
    };

    return this.build(raw, kindMap[prefix] || "user", id);
  }

  private build(raw: string, kind: MessagingTargetKind, id: string): MessagingTarget {
    return {
      kind,
      id,
      raw,
      normalized: this.normalize(kind, id),
    };
  }

  private normalize(kind: MessagingTargetKind, id: string): string {
    return `${kind}:${id}`.toLowerCase();
  }
}

// ── Target Resolver ─────────────────────────────────────────────

export interface TargetResolution {
  target: MessagingTarget;
  resolved: boolean;
  displayName?: string;
  error?: string;
}

export class TargetResolver {
  private directoryCache = new Map<string, { name?: string; resolved: boolean }>();

  async resolve(target: MessagingTarget): Promise<TargetResolution> {
    const cacheKey = target.normalized;
    const cached = this.directoryCache.get(cacheKey);

    if (cached?.resolved) {
      return {
        target,
        resolved: true,
        displayName: cached.name,
      };
    }

    try {
      const displayName = await this.lookupDisplayName(target);
      
      if (displayName) {
        this.directoryCache.set(cacheKey, { name: displayName, resolved: true });
        return { target, resolved: true, displayName };
      }

      return { target, resolved: false };
    } catch (error) {
      return {
        target,
        resolved: false,
        error: String(error),
      };
    }
  }

  private async lookupDisplayName(target: MessagingTarget): Promise<string | undefined> {
    logger.debug(`[TargetResolver] Looking up: ${target.kind} ${target.id}`);
    return undefined;
  }

  cache(target: MessagingTarget, name: string): void {
    this.directoryCache.set(target.normalized, { name, resolved: true });
  }

  invalidate(target: MessagingTarget): void {
    this.directoryCache.delete(target.normalized);
  }

  clearCache(): void {
    this.directoryCache.clear();
  }
}

// ── Target Display Formatter ────────────────────────────────────

export function formatTargetDisplay(
  target: MessagingTarget,
  options?: { includeKind?: boolean; emoji?: boolean }
): string {
  const { includeKind = true, emoji = true } = options || {};

  const emojiMap: Record<MessagingTargetKind, string> = {
    user: "👤",
    channel: "#",
    group: "👥",
    room: "🏠",
  };

  if (emoji && emojiMap[target.kind]) {
    return `${emojiMap[target.kind]} ${target.id}`;
  }

  if (includeKind) {
    return `${target.kind}:${target.id}`;
  }

  return target.id;
}

// ── Global Instance ────────────────────────────────────────────

export const defaultTargetParser = new TargetParser({
  defaultKind: "user",
});

export const defaultTargetResolver = new TargetResolver();
