// ============================================================
// 🦀 Krab — Plugin SDK: Core Types & Interfaces
// Types for building Krab plugins (channel plugins, tools, etc.)
// ============================================================

export * from "./types/adapters.js";
export * from "./types/core.js";
export * from "./types.channel.js";
export * from "./types.plugin.js";

// ── Helper Functions ─────────────────────────────────────────
export { createAccountListHelpers } from "./helpers/account-list.js";
export { createJsonStore } from "./helpers/json-store.js";
export { createTempPath } from "./helpers/temp-path.js";
export { createTextChunking } from "./helpers/text-chunking.js";
export { createOutboundMedia } from "./helpers/outbound-media.js";
export { createPersistentDedupe } from "./helpers/persistent-dedupe.js";
export { createAllowFrom } from "./helpers/allow-from.js";
export { createChannelLifecycle } from "./helpers/channel-lifecycle.js";
export { createFetchAuth } from "./helpers/fetch-auth.js";
export { createStatusHelpers } from "./helpers/status-helpers.js";

// ── Runtime & Context ───────────────────────────────────────
export { createPluginRuntime, type PluginRuntime } from "./runtime.js";
export type { PluginServicesHandle } from "./services.js";
