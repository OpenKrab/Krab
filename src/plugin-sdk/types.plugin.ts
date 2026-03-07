// ============================================================
// 🦀 Krab — Plugin SDK: Plugin Declaration
// Types for declaring plugins
// ============================================================
import { z } from "zod";

export const PluginConfigFieldSchema = z.object({
  description: z.string(),
  required: z.boolean().optional().default(false),
  secret: z.boolean().optional().default(false),
  default: z.any().optional(),
});

export const PluginToolEntrySchema = z.object({
  name: z.string(),
  export: z.string(),
});

export const PluginChannelEntrySchema = z.object({
  name: z.string(),
  export: z.string(),
});

export const PluginManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9@][a-z0-9._\-/]*$/),
  version: z.string().default("1.0.0"),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  krab: z.object({
    minVersion: z.string().optional(),
    type: z.enum(["tool", "channel", "agent", "middleware", "mixed"]),
    entry: z.string().default("./dist/index.js"),
    permissions: z.array(z.enum(["network", "filesystem", "shell", "browser", "system"])).optional().default([]),
    config: z.record(z.string(), PluginConfigFieldSchema).optional(),
  }),
  tools: z.array(PluginToolEntrySchema).optional().default([]),
  channels: z.array(PluginChannelEntrySchema).optional().default([]),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginConfigField = z.infer<typeof PluginConfigFieldSchema>;
export type PluginToolEntry = z.infer<typeof PluginToolEntrySchema>;
