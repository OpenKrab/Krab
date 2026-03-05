// ============================================================
// 🦀 Krab — Plugin System (Public API)
// ============================================================
export { PluginLoader, pluginLoader } from "./loader.js";
export { scaffoldPlugin, type ScaffoldOptions } from "./scaffold.js";
export {
  PluginManifestSchema,
  type PluginManifest,
  type LoadedPlugin,
  type MiddlewareContext,
  type MiddlewareFn,
  type MiddlewareEntry,
  type PluginRegistryFile,
  type PluginRegistryEntry,
  type PluginConfigField,
  type ToolDefinition,
  type ToolResult,
} from "./types.js";
