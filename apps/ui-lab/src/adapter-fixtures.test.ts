import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { adapterClient, adapterFixtureResources } from "./adapter-fixtures";
const pageSchema = z.array(
  z.object({
    adapter: z.string(),
    name: z.string(),
    path: z.string(),
    nodes: z.array(
      z.object({ kind: z.string(), props: z.record(z.unknown()) }),
    ),
  }),
);
test("official adapter pages have local resources and collection-compatible fixtures", async () => {
  const pages = pageSchema.parse(
    JSON.parse(
      execFileSync(
        "bun",
        [new URL("../adapter-snapshots.ts", import.meta.url).pathname],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      ),
    ),
  );
  expect([...new Set(pages.map((page) => page.adapter))].sort()).toEqual([
    "airflow",
    "clickhouse",
    "dbt",
    "duckdb",
    "postgresql",
    "s3",
  ]);
  const ids = pages.map((page) => `${page.adapter}/${page.name}`);
  expect(new Set(ids).size).toBe(ids.length);
  for (const page of pages) {
    const client = adapterClient(page.nodes, "normal", () => {});
    for (const [resourceId, definition] of adapterFixtureResources(
      page.nodes,
    )) {
      const value = await client.executeResource({ resourceId });
      expect(
        value,
        `${page.adapter}/${page.path}: ${resourceId}`,
      ).toBeDefined();
      if (definition.shape === "collection")
        expect(
          Array.isArray(value),
          `${page.adapter}/${page.path}: collection ${resourceId}`,
        ).toBe(true);
    }
  }
});
