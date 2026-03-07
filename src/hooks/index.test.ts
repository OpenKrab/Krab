// ============================================================
// 🦀 Krab — Hooks System Tests
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HooksManager, HookEvent } from "./index.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Hooks System", () => {
  let hooksManager: HooksManager;
  const testWorkspaceDir = path.join(os.tmpdir(), "krab-hooks-test");

  beforeEach(() => {
    // Create test workspace
    if (!fs.existsSync(testWorkspaceDir)) {
      fs.mkdirSync(testWorkspaceDir, { recursive: true });
    }

    // Reset hooks manager for each test
    hooksManager = new HooksManager();
  });

  afterEach(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  describe("Hook Discovery", () => {
    it("should discover bundled hooks", () => {
      const hooks = hooksManager.getHooks();
      expect(hooks.length).toBeGreaterThan(0);
      expect(hooks.some(h => h.metadata.name === "session-memory")).toBe(true);
    });

    it("should load hook metadata correctly", () => {
      const hooks = hooksManager.getHooks();
      const sessionMemoryHook = hooks.find(h => h.metadata.name === "session-memory");

      expect(sessionMemoryHook).toBeDefined();
      expect(sessionMemoryHook?.metadata.description).toContain("Save session context");
      expect(sessionMemoryHook?.metadata.metadata.openclaw.events).toContain("message:assistant");
    });
  });

  describe("Event Firing", () => {
    it("should fire events to matching hooks", async () => {
      const mockHandler = {
        execute: vi.fn().mockResolvedValue(undefined)
      };

      // Mock a hook
      const mockHook = {
        metadata: {
          name: "test-hook",
          description: "Test hook",
          metadata: {
            openclaw: {
              events: ["test:event"],
              export: "default"
            }
          }
        },
        handler: mockHandler,
        path: "/test",
        enabled: true
      };

      // Manually add mock hook (since discovery is automatic)
      (hooksManager as any).hooks.set("test-hook", mockHook);

      const event: HookEvent = {
        type: "test:event",
        data: { test: "data" },
        timestamp: new Date(),
        sessionId: "test-session"
      };

      await hooksManager.fireEvent(event);

      expect(mockHandler.execute).toHaveBeenCalledWith(event);
    });

    it("should not fire events to non-matching hooks", async () => {
      const mockHandler = {
        execute: vi.fn().mockResolvedValue(undefined)
      };

      const mockHook = {
        metadata: {
          name: "test-hook",
          description: "Test hook",
          metadata: {
            openclaw: {
              events: ["other:event"],
              export: "default"
            }
          }
        },
        handler: mockHandler,
        path: "/test",
        enabled: true
      };

      (hooksManager as any).hooks.set("test-hook", mockHook);

      const event: HookEvent = {
        type: "test:event",
        data: { test: "data" },
        timestamp: new Date(),
        sessionId: "test-session"
      };

      await hooksManager.fireEvent(event);

      expect(mockHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe("Hook Management", () => {
    it("should enable and disable hooks", () => {
      const hooks = hooksManager.getHooks();
      if (hooks.length > 0) {
        const firstHook = hooks[0];

        expect(hooksManager.disableHook(firstHook.metadata.name)).toBe(true);
        expect(firstHook.enabled).toBe(false);

        expect(hooksManager.enableHook(firstHook.metadata.name)).toBe(true);
        expect(firstHook.enabled).toBe(true);
      }
    });

    it("should return false for non-existent hooks", () => {
      expect(hooksManager.enableHook("non-existent")).toBe(false);
      expect(hooksManager.disableHook("non-existent")).toBe(false);
    });
  });
});
