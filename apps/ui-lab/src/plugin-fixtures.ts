import type { RendererClient } from "@northgraindata/dsui-renderer";
import { z } from "zod";

const now = Date.UTC(2026, 10, 14, 10, 42);
const at = new Date(now).toISOString();
export const services = [
  { id: "airflow", name: "Orders pipeline", adapter: "airflow" },
  { id: "postgresql", name: "Analytics warehouse", adapter: "postgresql" },
  { id: "dbt", name: "Analytics models", adapter: "dbt" },
];
const connection = {
  id: "00000000-0000-4000-8000-000000000001",
  serviceId: "dbt",
  name: "Analytics transformations",
  provider: "github",
  instance: "github",
  repository: "northgraindata/analytics",
  branch: "main",
  folder: "models",
  instructions: "",
  revision: 1,
  status: "ready",
  lastAttemptAt: at,
  lastFetchedAt: at,
  error: null,
  version: "a91b23f",
};
export function pluginFixtures(plugin: string, state: string) {
  const empty = state === "empty";
  if (plugin === "agent")
    return {
      configured: state !== "unconfigured",
      model: { provider: "openai", id: "gpt-4.1" },
      models: [
        {
          key: "default",
          label: "Workspace model",
          provider: "openai",
          id: "gpt-4.1",
        },
      ],
      services,
      conversations: empty
        ? []
        : [
            {
              id: "orders",
              title: "Why are orders delayed?",
              status: state === "running" ? "running" : "idle",
            },
          ],
      ...(empty || state === "unconfigured"
        ? {}
        : {
            conversation: {
              id: "orders",
              ownerId: "lab",
              title: "Why are orders delayed?",
              serviceIds: ["airflow", "dbt"],
              status:
                state === "running"
                  ? "running"
                  : state === "failed"
                    ? "error"
                    : "idle",
              ...(state === "failed"
                ? {
                    error:
                      "Model provider timed out. You can retry this message.",
                  }
                : {}),
              messages: [
                {
                  id: "u1",
                  role: "user",
                  text: "Why did the orders pipeline fail this morning?",
                  createdAt: at,
                },
                {
                  id: "a1",
                  role: "assistant",
                  text:
                    state === "stress"
                      ? "The source file changed its delimiter. ".repeat(45)
                      : "The **orders_daily** pipeline stopped at `load_orders`. The source file uses semicolons while the parser expects commas.\n\n1. Review the parser configuration.\n2. Retry the failed task.\n3. Check the row count in `analytics.orders`.",
                  createdAt: at,
                },
              ],
              tools: [
                {
                  id: "t1",
                  messageId: "a1",
                  name: "query_resource",
                  input: { serviceId: "airflow", resourceId: "task-log" },
                  output: { rows: 3 },
                  status: state === "running" ? "running" : "completed",
                },
              ],
            },
          }),
    };
  if (plugin === "repository")
    return {
      overview: {
        refreshMinutes: 5,
        services: services.map((service) => ({
          ...service,
          connections:
            service.id === "dbt" && !empty
              ? [
                  {
                    ...connection,
                    status:
                      state === "syncing"
                        ? "syncing"
                        : state === "failed"
                          ? "error"
                          : "ready",
                    error:
                      state === "failed"
                        ? "Repository is temporarily unavailable"
                        : null,
                  },
                ]
              : [],
        })),
        providers: {
          github: true,
          gitlab: [{ id: "gitlab", url: "https://gitlab.example.com" }],
          local: true,
        },
      },
      tree: {
        connection,
        files: empty
          ? []
          : [
              { path: "models/orders.sql", size: 164 },
              { path: "models/schema.yml", size: 220 },
            ],
      },
      file: {
        path: "models/orders.sql",
        size: 164,
        content:
          "select order_id, customer_id, amount\nfrom {{ ref('stg_orders') }}\nwhere amount > 0",
        reason: null,
        version: "a91b23f",
      },
    };
  if (plugin === "notifications")
    return {
      settings: { enabled: state !== "paused", excludedServiceIds: [] },
      managedSettings: { enabled: false, excludedServiceIds: false },
      channels: empty
        ? []
        : [
            {
              id: "analytics-alerts",
              name: "Analytics alerts",
              provider: "slack",
              enabled: true,
              managed: false,
              configured: true,
            },
          ],
      rules: empty
        ? []
        : [
            {
              id: "pipeline-failures",
              name: "Production pipeline failures",
              enabled: true,
              serviceIds: ["airflow"],
              excludedServiceIds: [],
              signalIds: ["airflow.task-failed"],
              types: ["error"],
              channelIds: ["analytics-alerts"],
              includeGlobalSignals: false,
              cooldownSeconds: 60,
              managed: false,
            },
          ],
      deliveries: empty
        ? []
        : [
            {
              id: "00000000-0000-4000-8000-000000000002",
              channelId: "analytics-alerts",
              channelName: "Analytics alerts",
              provider: "slack",
              event: {
                id: "event-1",
                signalId: "airflow.task-failed",
                type: "error",
                serviceId: "airflow",
                summary: "Orders ingestion failed after delimiter change",
                occurredAt: at,
              },
              ruleIds: ["pipeline-failures"],
              status: state === "failed" ? "failed" : "sent",
              attempts: 1,
              error:
                state === "failed"
                  ? "Destination temporarily unavailable"
                  : null,
              nextAttemptAt: now,
              createdAt: now,
              updatedAt: now,
            },
          ],
      services,
      signals: [
        { id: "airflow.task-failed", type: "error", serviceId: "airflow" },
      ],
      cursor: null,
      backlog: false,
      cloudAvailable: false,
    };
  if (plugin === "mcp")
    return {
      overview: {
        listener: {
          running: state !== "offline",
          url: "http://localhost:8787/mcp",
          error: state === "offline" ? "Listener could not start" : null,
        },
        admin: state !== "readonly",
        executeEnabled: true,
        oauthEnabled: true,
        maxTokenTtlDays: 365,
        services,
        tokens: empty
          ? []
          : [
              {
                id: "lab-token",
                name: "Claude Code · local laptop",
                prefix: "dsui_mcp_demo",
                scope: "read",
                serviceIds: [],
                actions: [],
                createdAt: now,
                expiresAt: now + 86400000 * 30,
                revokedAt: null,
                lastUsedAt: now,
                status: "active",
                mine: true,
                ownerId: "lab",
                kind: "static",
                clientName: null,
              },
            ],
      },
      activity: {
        admin: true,
        calls: empty
          ? []
          : [
              {
                id: "call-1",
                tokenId: "lab-token",
                tokenName: "Claude Code",
                ownerId: "lab",
                tool: "query_resource",
                status: "success",
                inputSummary: "dbt / models",
                errorCode: null,
                errorMessage: null,
                outputBytes: 2400,
                truncated: false,
                enqueuedAt: now,
                durationMs: 24,
              },
            ],
      },
      authorization: {
        state: state === "expired" ? "expired" : "pending",
        client: {
          name: "Claude Code",
          redirectUri: "http://localhost:1234/callback",
          redirectHost: "localhost",
        },
        requestedScope: "read",
        executeEnabled: true,
        services,
      },
    };
  if (plugin === "auth")
    return {
      users: {
        items: empty
          ? []
          : [
              {
                id: "user-1",
                name: "Alex Morgan",
                email: "alex@example.test",
                role: "owner",
                teamIds: ["team-1"],
                banned: false,
                emailVerified: true,
                createdAt: at,
              },
            ],
        invitations: [],
        services,
        minPasswordLength: 12,
      },
      teams: {
        items: empty
          ? []
          : [
              {
                id: "team-1",
                name: "Analytics",
                services: ["dbt"],
                members: 1,
              },
            ],
      },
    };
  throw new Error(`Unknown plugin fixture: ${plugin}`);
}
const inputSchema = z
  .object({ conversationId: z.string().optional() })
  .passthrough();
export function pluginClient(
  plugin: string,
  state: string,
  record: (event: string) => void,
): RendererClient {
  const fixtures = pluginFixtures(plugin, state);
  const read = (id: string): unknown => {
    if (plugin === "notifications") {
      if (id !== "overview")
        throw new Error(`Missing notifications resource: ${id}`);
      return fixtures;
    }
    if (!(id in fixtures)) throw new Error(`Missing ${plugin} fixture: ${id}`);
    return Reflect.get(fixtures, id);
  };
  const pending = () => new Promise<never>(() => undefined);
  return {
    connection: { name: "Local fixture", endpoint: "local://ui-lab" },
    async executeResource(ref) {
      if (state === "loading") return pending();
      if (state === "error")
        throw new Error("Fixture: could not load data. Try again.");
      return read(ref.resourceId);
    },
    async executeAction(ref) {
      if (state === "loading") return pending();
      if (state === "error")
        return {
          status: "error",
          message: "Fixture: could not load data. Try again.",
        };
      record(`Local action: ${ref.actionId}`);
      if (plugin === "agent") {
        if (
          ref.actionId === "state" ||
          ref.actionId === "send" ||
          ref.actionId === "stop" ||
          ref.actionId === "rename"
        ) {
          inputSchema.parse(ref.input ?? {});
          return { status: "success", data: fixtures };
        }
      } else if (plugin === "auth" && ["users", "teams"].includes(ref.actionId))
        return { status: "success", data: read(ref.actionId) };
      // Mutations in previews are deliberately rejected until a fixture models their result.
      return {
        status: "error",
        message: `Preview only: ${ref.actionId} was not sent.`,
      };
    },
    navigate(path) {
      record(`Navigate: ${path}`);
    },
    openOverlay(id) {
      record(`Open: ${id}`);
    },
    closeOverlay() {
      record("Closed overlay");
    },
  };
}
