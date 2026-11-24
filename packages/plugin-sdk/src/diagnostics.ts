/** Metadata only: inputs, connection details and result bodies are never collected. */
export interface DiagnosticOperation {
  id: string;
  adapterId: string;
  serviceId: string | null;
  kind: string;
  startedAt: number;
  durationMs: number;
  outcome: "active" | "success" | "error";
}

export interface DiagnosticProcess {
  adapterId: string;
  serviceId: string | null;
  pid: number;
  rssBytes: number | null;
  cpuPercent: number | null;
}

export interface DiagnosticSnapshot {
  processes?: readonly DiagnosticProcess[];
  operations: readonly DiagnosticOperation[];
  droppedOperations: number;
}
