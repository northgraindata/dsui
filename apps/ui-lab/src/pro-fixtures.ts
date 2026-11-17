import type { RendererClient } from "@northgraindata/dsui-renderer";
import { z } from "zod";
import { epoch } from "./fixtures";

export const runId = "10000000-0000-4000-8000-000000000001";
const rule = {
  id: "pipeline-health",
  name: "Investigate pipeline failures",
  modelId: "diagnostics",
  managed: false,
};
const report = {
  summary: "Orders ingestion failed after the CSV delimiter changed.",
  rootCause:
    "The source file uses semicolons; the ingestion parser expects commas.",
  impact: "The daily orders table has not been refreshed.",
  confidence: "likely",
  evidence: ["Task log", "Recorded CSV header"],
  actions: [],
  verification: [
    "Compared both delimiter settings against the recorded sample.",
  ],
  nextSteps: ["Review the parser configuration before retrying ingestion."],
  claims: [
    {
      text: "The input header is parsed as a single column.",
      evidenceIds: ["csv-header"],
    },
  ],
};
function investigationFixtures(state: string) {
  const empty = state === "empty";
  const run = {
    id: runId,
    serviceId: "airflow",
    serviceName: "Orders pipeline",
    eventId: "task-failed",
    signalId: "task-failed",
    payload: { dag: "ingest_orders" },
    rule,
    status:
      state === "running"
        ? "running"
        : state === "failed"
          ? "failed"
          : "completed",
    createdAt: epoch - 480000,
    updatedAt: epoch,
    finishedAt: epoch,
    report:
      empty || state === "running" || state === "failed"
        ? null
        : {
            ...report,
            confidence: state === "inconclusive" ? "unknown" : "likely",
          },
    reportState: state === "draft" ? "draft" : "final",
    steps: 12,
    costUsd: 0.028,
    observations: empty
      ? []
      : [
          {
            id: "csv-header",
            kind: "query_resource",
            serviceId: "s3",
            observedAt: epoch - 60000,
            input: { path: "landing/orders/latest.csv" },
            output: { header: "order_id;customer_id;amount;currency" },
            truncated: false,
          },
        ],
  };
  const variants = [
    {
      status: "completed",
      serviceId: "airflow",
      serviceName: "Orders pipeline",
      error: null,
      report,
    },
    {
      status: "running",
      serviceId: "postgresql",
      serviceName: "Analytics warehouse",
      error: null,
      report: null,
    },
    {
      status: "failed",
      serviceId: "airflow",
      serviceName: "Orders pipeline",
      error: "Model request timed out",
      report: null,
    },
    {
      status: "completed",
      serviceId: "postgresql",
      serviceName: "Analytics warehouse",
      error: null,
      report: { ...report, confidence: "unknown" },
    },
  ];
  const runs = empty
    ? []
    : Array.from({ length: state === "stress" ? 36 : 4 }, (_, i) => {
        const variant = variants[i % variants.length];
        return {
          ...run,
          ...variant,
          id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
          serviceName:
            state === "stress"
              ? `Production analytics warehouse with a long service name ${i}`
              : variant.serviceName,
        };
      });
  return { run, runs };
}
function overviewFixture(
  state: string,
  runs: ReturnType<typeof investigationFixtures>["runs"],
) {
  const empty = state === "empty";
  return {
    permissions: {
      manage: state !== "readonly",
      executeServiceIds:
        state === "readonly" ? [] : ["airflow", "postgresql", "s3"],
    },
    totals: { running: empty ? 0 : 1, completed: empty ? 0 : 2 },
    enabled: state !== "paused",
    managedEnabled: true,
    services: [
      {
        id: "airflow",
        name: "Orders pipeline",
        adapter: "airflow",
        iconUrl: new URL(
          "../../site/public/assets/logos/airflow.svg",
          import.meta.url,
        ).href,
        managedBy: "local",
      },
      {
        id: "postgresql",
        name: "Analytics warehouse",
        adapter: "postgresql",
        iconUrl: new URL(
          "../../site/public/assets/logos/postgresql.svg",
          import.meta.url,
        ).href,
        managedBy: "local",
      },
      {
        id: "s3",
        name: "Landing bucket",
        adapter: "s3",
        managedBy: "local",
        iconUrl: new URL(
          "../../site/public/assets/logos/s3.svg",
          import.meta.url,
        ).href,
      },
    ],
    signals: [
      { serviceId: "airflow", items: [{ id: "task-failed", type: "error" }] },
    ],
    rules: empty
      ? []
      : [
          {
            ...rule,
            enabled: state !== "paused",
            serviceIds: ["airflow"],
            signalIds: ["task-failed"],
          },
        ],
    channels: [],
    models: [
      {
        id: "diagnostics",
        providerId: "local",
        model: "fixture-model",
        configured: true,
        lastCheck: null,
      },
    ],
    providers: [{ id: "local", provider: "openai", configured: true }],
    runs,
    deliveries: [],
    codeRepositoriesAvailable: true,
    publishing: { github: false, gitlab: [] },
    activity: [],
    manualPolicy: {
      resourceIds: ["task-log", "file-preview"],
      contextServiceIds: ["s3", "postgresql"],
    },
    limits: {
      maxSteps: 40,
      timeoutMs: 300000,
      maxConcurrentRuns: 2,
      retentionDays: 30,
      maxTokensPerRun: 64000,
    },
  };
}
function evidenceFixtures(state: string) {
  const empty = state === "empty";
  const tableRows = empty
    ? []
    : Array.from({ length: state === "stress" ? 80 : 4 }, (_, i) => [
        i + 1001,
        i % 3 ? i + 201 : null,
        Math.round((i + 1) * 12.35 * 100) / 100,
        i % 2 ? "EUR" : "PLN",
      ]);
  const logs = empty
    ? []
    : [
        {
          at: "09:18:02",
          level: "info",
          message: "Reading landing/orders/latest.csv",
        },
        {
          at: "09:18:03",
          level: "warning",
          message: "Expected 4 columns; observed 1 column.",
        },
        {
          at: "09:18:03",
          level: "error",
          message:
            state === "stress"
              ? "ParserError: ".repeat(40)
              : "ParserError: required column order_id is missing.",
        },
      ];
  const timeline = empty
    ? []
    : [
        {
          id: "delivery",
          at: epoch - 600000,
          title: "File delivered",
          detail: "New orders CSV uploaded",
          icon: "file",
        },
        {
          id: "failure",
          at: epoch - 480000,
          title: "Pipeline failed",
          detail: "Unexpected delimiter",
          icon: "alert",
          tone: "error",
        },
        {
          id: "analysis",
          at: epoch - 300000,
          title: "Evidence inspected",
          detail: "Compared file header with parser settings",
          icon: "search",
        },
        {
          id: "report",
          at: epoch,
          title: "Report ready",
          detail: "Review the proposed next step",
          icon: "check",
        },
      ];
  return { tableRows, logs, timeline };
}
export function proFixtures(state: string) {
  const { run, runs } = investigationFixtures(state);
  const prompt =
    state === "stress"
      ? "Investigate delayed orders in the production analytics warehouse. ".repeat(
          8,
        )
      : "Why did ingest_orders fail after the latest source delivery?";
  return {
    run,
    overview: overviewFixture(state, runs),
    prompt,
    ...evidenceFixtures(state),
  };
}

const historyInput = z.object({
  search: z.string().default(""),
  status: z.string().default("visible"),
  serviceId: z.string().default("all"),
  since: z.number().optional(),
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
function historyFixture(state: string, input: unknown) {
  const query = historyInput.parse(input ?? {});
  const search = query.search.toLowerCase();
  const items = proFixtures(state).overview.runs.filter(
    (run) =>
      (query.status === "all" ||
        (query.status === "visible" && run.status !== "skipped") ||
        run.status === query.status) &&
      (query.serviceId === "all" || run.serviceId === query.serviceId) &&
      (query.since === undefined || run.createdAt >= query.since) &&
      `${run.serviceName} ${run.report?.summary ?? ""} ${run.error ?? ""}`
        .toLowerCase()
        .includes(search),
  );
  const offset = Number(query.cursor ?? 0);
  return {
    items: items.slice(offset, offset + query.limit),
    total: items.length,
    nextCursor:
      offset + query.limit < items.length ? String(offset + query.limit) : null,
  };
}

export function proClient(
  state: string,
  record: (event: string) => void,
): RendererClient {
  return {
    async executeResource(ref) {
      if (
        !["history", "source", "run", "activity", "session"].includes(
          ref.resourceId,
        )
      )
        throw new Error(`Missing Pro fixture resource: ${ref.resourceId}`);
      if (state === "loading") return new Promise<never>(() => undefined);
      if (state === "error")
        throw new Error("Fixture: investigation history could not be loaded.");
      if (ref.resourceId === "history") return historyFixture(state, ref.input);
      const fixtures = proFixtures(state);
      if (ref.resourceId === "run")
        return { run: fixtures.run, events: [], deliveries: [] };
      if (ref.resourceId === "activity") return { events: [] };
      if (ref.resourceId === "session")
        return {
          items: [
            {
              id: fixtures.run.id,
              title: fixtures.run.report?.summary ?? fixtures.run.serviceName,
              status: fixtures.run.status,
              createdAt: fixtures.run.createdAt,
              recovery: null,
            },
          ],
        };
      const input = z.object({ observationId: z.string() }).parse(ref.input);
      const observation = proFixtures(state).run.observations.find(
        (item) => item.id === input.observationId,
      );
      if (!observation)
        throw new Error(`Missing Pro fixture source: ${input.observationId}`);
      return observation;
    },
    async executeAction(ref) {
      if (
        ![
          "investigate",
          "save-rule",
          "delete-rule",
          "record-outcome",
          "approve-operation",
          "update-incident-status",
          "record-diagnosis-feedback",
        ].includes(ref.actionId)
      )
        throw new Error(`Missing Pro fixture action: ${ref.actionId}`);
      record(`Local action: ${ref.actionId}`);
      if (state === "loading") return new Promise<never>(() => undefined);
      if (state === "error")
        return {
          status: "error",
          message: "Fixture: investigation could not be started.",
        };
      return { status: "success", data: { id: runId } };
    },
    navigate(path) {
      record(`Local navigation: ${path}`);
    },
  };
}
