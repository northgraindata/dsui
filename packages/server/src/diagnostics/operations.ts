import { randomUUID } from "node:crypto";
import type {
  DiagnosticOperation,
  DiagnosticSnapshot,
} from "@northgraindata/dsui-plugin-sdk";
import type { AdapterBackend } from "../adapters/types.js";
import { createProcessSampler } from "./processes.js";

const MAX_RECENT = 500;
const MAX_ACTIVE = 1000;

export function createOperationDiagnostics() {
  const processes = new Map<string, AdapterBackend>();
  const wrapped = new WeakSet<AdapterBackend>();
  const sampleProcesses = createProcessSampler();
  const active = new Map<string, DiagnosticOperation>();
  const recent: DiagnosticOperation[] = [];
  let droppedOperations = 0;
  async function run<T>(
    adapterId: string,
    serviceId: string | undefined,
    kind: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const operation: DiagnosticOperation = {
      id: randomUUID(),
      adapterId,
      serviceId: serviceId ?? null,
      kind,
      startedAt: Date.now(),
      durationMs: 0,
      outcome: "active",
    };
    if (active.size < MAX_ACTIVE) active.set(operation.id, operation);
    else droppedOperations++;
    const started = performance.now();
    try {
      const result = await action();
      operation.outcome = "success";
      if (
        typeof result === "object" &&
        result !== null &&
        "result" in result &&
        typeof result.result === "object" &&
        result.result !== null &&
        "status" in result.result &&
        result.result.status === "error"
      )
        operation.outcome = "error";
      return result;
    } catch (error) {
      operation.outcome = "error";
      throw error;
    } finally {
      operation.durationMs = performance.now() - started;
      active.delete(operation.id);
      recent.push(operation);
      if (recent.length > MAX_RECENT) {
        recent.shift();
        droppedOperations++;
      }
    }
  }
  return {
    async snapshot(): Promise<DiagnosticSnapshot> {
      const now = Date.now();
      return {
        processes: await sampleProcesses(
          Array.from(processes.entries()).flatMap(([adapterId, backend]) =>
            (backend.processes?.() ?? []).map((entry) => ({
              ...entry,
              adapterId,
            })),
          ),
        ),
        operations: [
          ...recent,
          ...Array.from(active.values(), (operation) => ({
            ...operation,
            durationMs: now - operation.startedAt,
          })),
        ],
        droppedOperations,
      };
    },
    wrap(adapterId: string, backend: AdapterBackend): AdapterBackend {
      if (wrapped.has(backend)) return backend;
      processes.set(adapterId, backend);
      const result: AdapterBackend = {
        processes: () => backend.processes?.() ?? [],
        ...backend,
        validateConnection: (connection) =>
          backend.validateConnection(connection),
        close: async (drain) => {
          if (processes.get(adapterId) === backend) processes.delete(adapterId);
          await backend.close?.(drain);
        },
        invalidateService: (namespace) =>
          backend.invalidateService?.(namespace) ?? Promise.resolve(),
        checkHealth: (connection, context) =>
          run(adapterId, context?.persistenceNamespace, "health", () =>
            backend.checkHealth(connection, context),
          ),
        renderPage: (connection, path, context) =>
          run(adapterId, context?.persistenceNamespace, "page", () =>
            backend.renderPage(connection, path, context),
          ),
        executeResource: (id, connection, input, context) =>
          run(adapterId, context?.persistenceNamespace, "resource", () =>
            backend.executeResource(id, connection, input, context),
          ),
        executeAction: (id, connection, input, signal, context) =>
          run(adapterId, context?.persistenceNamespace, "action", () =>
            backend.executeAction(id, connection, input, signal, context),
          ),
        executeJob: (id, connection, input, options, context) =>
          run(adapterId, context?.persistenceNamespace, "job", () =>
            backend.executeJob(id, connection, input, options, context),
          ),
        executeRoute: (id, connection, call, options, context) =>
          run(adapterId, context?.persistenceNamespace, "route", () =>
            backend.executeRoute(id, connection, call, options, context),
          ),
      };
      wrapped.add(result);
      return result;
    },
  };
}
