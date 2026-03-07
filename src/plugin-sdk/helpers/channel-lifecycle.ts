// ============================================================
// 🦀 Krab — Plugin SDK: Channel Lifecycle Helper
// Manage channel startup/shutdown lifecycle
// ============================================================
import { logger } from "../../utils/logger.js";

export type LifecycleEvent = "start" | "stop" | "error" | "message" | "connect" | "disconnect";

export interface LifecycleCallbacks {
  onStart?: () => Promise<void>;
  onStop?: () => Promise<void>;
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function createChannelLifecycle(callbacks: LifecycleCallbacks) {
  let started = false;
  let stopping = false;
  
  return {
    get isStarted(): boolean {
      return started;
    },
    
    get isStopping(): boolean {
      return stopping;
    },
    
    async start(): Promise<void> {
      if (started) {
        logger.warn("[Lifecycle] Already started");
        return;
      }
      
      try {
        logger.info("[Lifecycle] Starting...");
        await callbacks.onStart?.();
        started = true;
        callbacks.onConnect?.();
        logger.info("[Lifecycle] Started successfully");
      } catch (error) {
        logger.error("[Lifecycle] Start failed:", error);
        callbacks.onError?.(error as Error);
        throw error;
      }
    },
    
    async stop(): Promise<void> {
      if (!started || stopping) {
        return;
      }
      
      stopping = true;
      
      try {
        logger.info("[Lifecycle] Stopping...");
        await callbacks.onStop?.();
        callbacks.onDisconnect?.();
        started = false;
        stopping = false;
        logger.info("[Lifecycle] Stopped successfully");
      } catch (error) {
        logger.error("[Lifecycle] Stop failed:", error);
        callbacks.onError?.(error as Error);
        throw error;
      }
    },
    
    handleMessage(message: any): void {
      if (!started) {
        logger.warn("[Lifecycle] Received message but not started");
        return;
      }
      callbacks.onMessage?.(message);
    },
  };
}
