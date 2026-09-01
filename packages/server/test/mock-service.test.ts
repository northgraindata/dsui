import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/app";

describe("adapter mock mode", () => {
  it("persists UI-created mock services without a master key", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "none",
    });
    try {
      const created = await runtime.app.request("/api/v1/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adapter: "mock",
          name: "Mock Airflow",
          connection: {
            serviceType: "airflow",
            preset: "realistic",
            health: "healthy",
            latencyMs: 15,
          },
        }),
      });
      expect(created.status).toBe(201);
      expect(await created.json()).toEqual(
        expect.objectContaining({
          name: "Mock Airflow",
          adapter: "airflow",
          endpoint: "mock://airflow/realistic",
          mocked: true,
        }),
      );
      const stored = runtime.database.listUiServices()[0];
      expect(stored.mock_settings).toContain('"serviceType":"airflow"');
      expect(stored.connection_ciphertext).toBe("");
    } finally {
      runtime.close();
    }
  });

  it("runs a Snowflake service without connection values", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "none",
      config: {
        services: [
          {
            id: "snowflake-mock",
            adapter: "mock",
            name: "Snowflake playground",
            connection: {
              serviceType: "snowflake",
              preset: "realistic",
              health: "healthy",
            },
          },
        ],
      },
    });
    try {
      const services = await runtime.app.request("/api/v1/services");
      expect(services.status).toBe(200);
      expect(await services.json()).toEqual([
        expect.objectContaining({
          id: "snowflake-mock",
          adapter: "snowflake",
          endpoint: "mock://snowflake/realistic",
          health: "healthy",
          mocked: true,
        }),
      ]);

      const manifest = await runtime.app.request(
        "/api/v1/services/snowflake-mock/manifest",
      );
      const views = (await manifest.json()) as {
        views: Array<{ id: string }>;
      };
      expect(views.views.map((view) => view.id)).toContain("warehouses");

      const query = await runtime.app.request(
        "/api/v1/services/snowflake-mock/capabilities/query",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sql: "SELECT * FROM CUSTOMERS" }),
        },
      );
      expect(query.status).toBe(200);
      expect(await query.json()).toEqual(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.arrayContaining(["row_101", "Acme Labs"]),
          ]),
          columns: ["ID", "NAME", "STATUS", "AMOUNT", "UPDATED_AT"],
        }),
      );
    } finally {
      runtime.close();
    }
  });

  it("transports ClickHouse workspace navigation in the service manifest", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "none",
      config: {
        services: [
          {
            id: "clickhouse-mock",
            adapter: "mock",
            name: "ClickHouse playground",
            connection: {
              serviceType: "clickhouse",
              preset: "realistic",
              health: "healthy",
            },
          },
        ],
      },
    });
    try {
      const response = await runtime.app.request(
        "/api/v1/services/clickhouse-mock/manifest",
      );
      expect(response.status).toBe(200);
      const manifest = (await response.json()) as {
        views: Array<{
          id: string;
          navigation?: {
            area: { id: string; label: string; order?: number };
            parent?: { capability: string };
          };
          databaseExplorer?: {
            tabs: Array<{ id: string; capability: string }>;
          };
        }>;
      };
      expect(
        manifest.views.find((view) => view.id === "explorer")?.navigation,
      ).toEqual({
        area: { id: "explorer", label: "Explorer", order: 10 },
      });
      expect(
        manifest.views
          .find((view) => view.id === "explorer")
          ?.databaseExplorer?.tabs.map(({ id, capability }) => ({
            id,
            capability,
          })),
      ).toEqual([
        { id: "overview", capability: "table-overview" },
        { id: "columns", capability: "table-columns" },
        { id: "data", capability: "table-preview" },
        { id: "ddl", capability: "table-ddl" },
        { id: "parts", capability: "table-parts" },
      ]);

      const operation = async (capability: string, input: unknown = {}) => {
        const result = await runtime.app.request(
          `/api/v1/services/clickhouse-mock/capabilities/${capability}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        expect(result.status).toBe(200);
        return (await result.json()) as { data: unknown; columns?: string[] };
      };

      expect(await operation("schemas")).toEqual(
        expect.objectContaining({
          columns: ["database", "engine"],
          data: expect.arrayContaining([["analytics", "Atomic"]]),
        }),
      );
      expect(
        await operation("database-objects", { database: "analytics" }),
      ).toEqual(
        expect.objectContaining({
          columns: [
            "database",
            "name",
            "object_type",
            "engine",
            "total_rows",
            "total_bytes",
          ],
          data: expect.arrayContaining([
            ["analytics", "events", "table", "MergeTree", 240, 49152],
          ]),
        }),
      );
      expect(
        await operation("table-columns", {
          database: "analytics",
          table: "events",
        }),
      ).toEqual(
        expect.objectContaining({
          columns: expect.arrayContaining([
            "name",
            "type",
            "compression_codec",
          ]),
          data: expect.arrayContaining([
            expect.arrayContaining(["event_id", "UInt64"]),
          ]),
        }),
      );
      expect(
        await operation("table-preview", {
          database: "analytics",
          table: "events",
          limit: 100,
          offset: 100,
        }),
      ).toEqual(
        expect.objectContaining({
          columns: ["event_id", "event_type", "occurred_at", "payload"],
          data: expect.arrayContaining([
            expect.arrayContaining([101, "cart.updated"]),
          ]),
        }),
      );
      expect(
        await operation("table-ddl", {
          database: "analytics",
          table: "events",
        }),
      ).toEqual(
        expect.objectContaining({
          data: [[expect.stringContaining("CREATE TABLE analytics.events")]],
        }),
      );
    } finally {
      runtime.close();
    }
  });
});
