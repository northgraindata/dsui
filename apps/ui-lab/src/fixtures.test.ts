import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { createClient, dataRows } from "./fixtures";

describe("local fixture contract", () => {
  test("resources are deterministic and never silently accept unknown ids", async () => {
    const client = createClient("normal");
    expect(await client.executeResource({ resourceId: "tables" })).toEqual(
      dataRows("normal"),
    );
    expect(await client.executeResource({ resourceId: "tables" })).toEqual(
      dataRows("normal"),
    );
    await expect(
      client.executeResource({ resourceId: "not-registered" }),
    ).rejects.toThrow("Missing UI Lab fixture");
  });
  test("empty, error and stress states differ observably", async () => {
    expect(
      await createClient("empty").executeResource({ resourceId: "tables" }),
    ).toEqual([]);
    await expect(
      createClient("error").executeResource({ resourceId: "tables" }),
    ).rejects.toThrow("timed out");
    expect(dataRows("stress")).toHaveLength(120);
    expect(dataRows("stress").some((row) => row.rows === null)).toBe(true);
  });
  test("loading stays pending instead of resolving to empty data", async () => {
    const outcome = await Promise.race([
      createClient("loading")
        .executeResource({ resourceId: "tables" })
        .then(() => "resolved"),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("pending"), 10),
      ),
    ]);
    expect(outcome).toBe("pending");
  });
  test("actions stay local and return the production query-result shape", async () => {
    const events: string[] = [];
    const client = createClient("normal", (event) => events.push(event));
    expect(
      await client.executeAction({
        actionId: "query",
        input: { sql: "select 1" },
      }),
    ).toEqual({
      status: "success",
      data: {
        columns: ["name", "type", "rows", "status"],
        rows: dataRows("normal"),
        elapsedMs: 24,
      },
    });
    client.navigate("/tables/orders");
    expect(events).toEqual(["Action: query", "Navigate: /tables/orders"]);
    expect(
      await createClient("error").executeAction({ actionId: "save" }),
    ).toEqual({ status: "error", message: "Fixture: action failed." });
    await expect(
      client.executeAction({ actionId: "not-registered" }),
    ).rejects.toThrow("Missing UI Lab action");
  });
});

test("every public SDK primitive has a catalog entry or an explicit documented gap", async () => {
  const primitives = new URL(
    "../../../packages/adapter-sdk/src/components/primitives/",
    import.meta.url,
  );
  const catalog = await readFile(
    new URL("./sdk-catalog.tsx", import.meta.url),
    "utf8",
  );
  for (const file of await readdir(primitives)) {
    if (!file.endsWith(".ts")) continue;
    const contents = await readFile(new URL(file, primitives), "utf8");
    for (const match of contents.matchAll(/id:\s*"([\w-]+)"/g)) {
      const id = match[1];
      expect(catalog, `Missing example for ${id}`).toMatch(
        new RegExp(
          `(?:block|bound)\\(\\s*["']${id}["']|id:\\s*["']sdk/${id}["']`,
        ),
      );
    }
  }
});

test("every exported shared UI component has an entry", async () => {
  const exports = await readFile(
    new URL("../../../packages/ui/src/index.tsx", import.meta.url),
    "utf8",
  );
  const catalog = await readFile(
    new URL("./ui-catalog.tsx", import.meta.url),
    "utf8",
  );
  for (const match of exports.matchAll(/from "\.\/components\/([\w-]+)"/g)) {
    if (match[1] === "cn") continue;
    expect(catalog, `Missing shared UI entry: ${match[1]}`).toMatch(
      new RegExp(`entry\\(\\s*["']${match[1]}["']`),
    );
  }
});

test("Pro actions return local success or failure without accepting unknown actions", async () => {
  const { proClient, runId } = await import("./pro-fixtures");
  const events: string[] = [];
  const client = proClient("normal", (event) => events.push(event));
  expect(
    await client.executeAction({
      actionId: "investigate",
      input: { serviceId: "airflow" },
    }),
  ).toEqual({ status: "success", data: { id: runId } });
  expect(events).toEqual(["Local action: investigate"]);
  expect(
    (
      await proClient("error", () => undefined).executeAction({
        actionId: "investigate",
      })
    ).status,
  ).toBe("error");
  await expect(
    client.executeAction({ actionId: "unregistered" }),
  ).rejects.toThrow("Missing Pro fixture action");
  await expect(
    client.executeResource({ resourceId: "unregistered" }),
  ).rejects.toThrow("Missing Pro fixture resource");
});

test("Pro history supports filtering and pagination used by the actual list", async () => {
  const { proClient } = await import("./pro-fixtures");
  const client = proClient("stress", () => undefined);
  expect(
    await client.executeResource({
      resourceId: "history",
      input: { limit: 20 },
    }),
  ).toMatchObject({ total: 36, nextCursor: "20" });
  expect(
    await client.executeResource({
      resourceId: "history",
      input: { limit: 20, cursor: "20" },
    }),
  ).toMatchObject({ total: 36, nextCursor: null });
  expect(
    await client.executeResource({
      resourceId: "history",
      input: { status: "failed" },
    }),
  ).toMatchObject({ total: 9, nextCursor: null });
  expect(
    await client.executeResource({
      resourceId: "history",
      input: { search: "no matching investigation" },
    }),
  ).toEqual({ items: [], total: 0, nextCursor: null });
});

test("Pro evidence dialogs retrieve recorded sources by their observation id", async () => {
  const { proClient } = await import("./pro-fixtures");
  const client = proClient("normal", () => undefined);
  expect(
    await client.executeResource({
      resourceId: "source",
      input: {
        id: "10000000-0000-4000-8000-000000000001",
        observationId: "csv-header",
      },
    }),
  ).toMatchObject({
    kind: "query_resource",
    output: { header: "order_id;customer_id;amount;currency" },
  });
  await expect(
    client.executeResource({
      resourceId: "source",
      input: { observationId: "missing" },
    }),
  ).rejects.toThrow("Missing Pro fixture source");
});
