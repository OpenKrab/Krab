// ============================================================
// 🦀 Krab — Plugin SDK: JSON Store Helper
// Persistent JSON storage for plugins
// ============================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

export function createJsonStore<T extends object>(
  pluginDir: string,
  filename: string,
  defaults: T
): {
  get(): T;
  set(data: Partial<T>): void;
  save(): void;
} {
  const filePath = join(pluginDir, filename);
  
  let data: T;
  
  function load(): T {
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, "utf-8");
        return { ...defaults, ...JSON.parse(raw) };
      }
    } catch (e) {
      // Ignore errors, use defaults
    }
    return { ...defaults };
  }
  
  function ensureDir() {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
  
  data = load();
  
  return {
    get(): T {
      return data;
    },
    set(newData: Partial<T>): void {
      data = { ...data, ...newData };
    },
    save(): void {
      ensureDir();
      writeFileSync(filePath, JSON.stringify(data, null, 2));
    },
  };
}
