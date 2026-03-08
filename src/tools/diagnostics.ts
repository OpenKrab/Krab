export interface ToolExecutionDiagnosticEntry {
  timestamp: string;
  toolName: string;
  success: boolean;
  durationMs: number;
  sideEffect: boolean;
  error?: string;
  phase?: "policy" | "execution";
  decision?: "allowed" | "denied" | "approval_required" | "approved" | "rejected";
  reason?: string;
}

const MAX_TOOL_DIAGNOSTICS = 100;
const toolDiagnostics: ToolExecutionDiagnosticEntry[] = [];

export function recordToolExecutionDiagnostic(entry: ToolExecutionDiagnosticEntry): void {
  toolDiagnostics.push(entry);
  if (toolDiagnostics.length > MAX_TOOL_DIAGNOSTICS) {
    toolDiagnostics.splice(0, toolDiagnostics.length - MAX_TOOL_DIAGNOSTICS);
  }
}

export function getToolExecutionDiagnostics(): ToolExecutionDiagnosticEntry[] {
  return [...toolDiagnostics];
}

export function clearToolExecutionDiagnostics(): void {
  toolDiagnostics.length = 0;
}
