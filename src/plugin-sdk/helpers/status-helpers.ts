// ============================================================
// 🦀 Krab — Plugin SDK: Status Helpers
// Helper for channel status reporting
// ============================================================
export type ChannelStatus = "connected" | "disconnected" | "connecting" | "error" | "reconnecting";

export interface StatusIssue {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  timestamp: Date;
}

export interface ChannelStatusReport {
  status: ChannelStatus;
  connectedAt?: Date;
  lastActivity?: Date;
  issues: StatusIssue[];
  metadata?: Record<string, any>;
}

export function createStatusHelpers() {
  let currentStatus: ChannelStatus = "disconnected";
  let connectedAt: Date | undefined;
  let lastActivity: Date | undefined;
  const issues: StatusIssue[] = [];
  
  return {
    getStatus(): ChannelStatusReport {
      return {
        status: currentStatus,
        connectedAt,
        lastActivity,
        issues: [...issues],
      };
    },
    
    setConnected() {
      currentStatus = "connected";
      connectedAt = new Date();
      lastActivity = new Date();
    },
    
    setDisconnected() {
      currentStatus = "disconnected";
    },
    
    setConnecting() {
      currentStatus = "connecting";
    },
    
    setReconnecting() {
      currentStatus = "reconnecting";
    },
    
    setError(message: string, code: string = "ERROR") {
      currentStatus = "error";
      this.addIssue(code, message, "error");
    },
    
    updateActivity() {
      lastActivity = new Date();
    },
    
    addIssue(code: string, message: string, severity: StatusIssue["severity"] = "info") {
      issues.push({
        code,
        message,
        severity,
        timestamp: new Date(),
      });
      
      // Keep only last 10 issues
      if (issues.length > 10) {
        issues.shift();
      }
    },
    
    clearIssues() {
      issues.length = 0;
    },
    
    isHealthy(): boolean {
      return currentStatus === "connected" && !issues.some((i) => i.severity === "error");
    },
  };
}
