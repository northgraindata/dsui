import { beforeEach, expect, test } from "bun:test";
import adapter, { resetMockWorkspaces } from "../src/index";

beforeEach(resetMockWorkspaces);

const connection = adapter.connectionSchema.parse({
  serviceType: "snowflake",
  preset: "realistic",
});

test("requires no external connection values", async () => {
  const instance = adapter.create({}, adapter.connectionSchema.parse({}));
  expect((await instance.health()).status).toBe("healthy");
});

test("offers every real adapter as a service type", () => {
  const field = adapter.connectionFields.find(
    (item) => item.id === "serviceType",
  );
  for (const id of ["snowflake", "airflow", "dbt-cloud", "kafka"])
    expect(field?.options?.map((option) => option.value)).toContain(id);
});

test("covers every core renderer kind", () => {
  const kinds = new Set(adapter.capabilities.map((item) => item.view.kind));
  for (const kind of [
    "service-info",
    "query",
    "schema-browser",
    "table-browser",
    "topic-browser",
    "message-browser",
    "consumer-groups",
    "object-browser",
    "job-browser",
    "key-value-browser",
    "log-stream",
    "record-list",
    "record-detail",
    "action-form",
  ] as const)
    expect(kinds).toContain(kind);
});

test("writes are visible to later reads and resettable", async () => {
  const instance = adapter.create(
    { now: () => new Date("2026-01-01T00:00:00Z") },
    connection,
  );
  const before = (await instance.execute("records", {})) as {
    items: unknown[];
  };
  const created = (await instance.execute("create-record", {
    name: "Created in test",
    status: "active",
    owner: "Codex",
  })) as { id: string };
  const after = (await instance.execute("records", {})) as {
    items: Array<{ id: string }>;
  };
  expect(after.items).toHaveLength(before.items.length + 1);
  expect(after.items.some((item) => item.id === created.id)).toBe(true);

  await instance.execute("delete-record", { id: created.id });
  const deleted = (await instance.execute("records", {})) as {
    items: Array<{ id: string }>;
  };
  expect(deleted.items.some((item) => item.id === created.id)).toBe(false);

  await instance.execute("reset-data", {});
  const reset = (await instance.execute("records", {})) as { items: unknown[] };
  expect(reset.items).toHaveLength(before.items.length);
});

test("supports pagination and simulated failures", async () => {
  const instance = adapter.create({}, connection);
  const first = (await instance.execute("records", { limit: 2 })) as {
    items: unknown[];
    nextCursor?: string;
  };
  expect(first.items).toHaveLength(2);
  expect(first.nextCursor).toBe("2");
  expect(instance.execute("query", { sql: "select fail" })).rejects.toThrow(
    "Simulated query failure",
  );
});
