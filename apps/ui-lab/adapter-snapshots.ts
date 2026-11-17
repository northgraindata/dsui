/** Run by Bun in Vite's server process. Adapter backend modules never enter the browser. */
import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createStoreInstance,
  serializeNodes,
  type AnyPageDefinition,
  type StoreAccessor,
} from "@northgraindata/dsui-adapter-sdk";

const root = resolve(import.meta.dir, "../..");
const adapters = ["airflow", "clickhouse", "dbt", "duckdb", "postgresql", "s3"];
const snapshots = [];
for (const adapter of adapters) {
  const directory = resolve(root, `packages/adapter-${adapter}/src`);
  const files = (await readdir(directory, { recursive: true })).filter(
    (file) =>
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      (file.startsWith("pages/") ||
        ["pages.ts", "overview-page.ts", "management.ts"].includes(file)),
  );
  for (const file of files) {
    if (adapter === "duckdb" && file === "pages/config.ts") continue;
    if (adapter === "clickhouse" && file === "management.ts") continue;
    const source = resolve(directory, file);
    const module = await import(pathToFileURL(source).href);
    for (const [name, value] of Object.entries(module)) {
      if (
        !value ||
        typeof value !== "object" ||
        !("kind" in value) ||
        value.kind !== "page"
      )
        continue;
      const page = value as AnyPageDefinition;
      const stores: StoreAccessor = {
        use(definition) {
          const instance = createStoreInstance(definition);
          return { ...instance.get(), ...instance.actions };
        },
        get(definition) {
          return createStoreInstance(definition).get();
        },
      };
      const params = Object.fromEntries(
        [...page.path.matchAll(/[:*]([^/]+)/g)].map(([, key]) => [
          key,
          (
            {
              mapIndex: "0",
              tryNumber: "1",
              database: "analytics",
              schema: "public",
              table: "orders",
              relation: "orders",
              dagId: "orders_daily",
              runId: "run-2026-11-14",
              taskId: "load_orders",
              modelId: "model.analytics.fct_orders",
              bucket: "analytics-exports",
              notebookId: "welcome",
              assetId: "42",
              artifactName: "manifest.json",
              dagRunId: "scheduled__2026-11-14",
              relationType: "table",
              extension: "httpfs",
              path: "models/orders.sql",
              name: "httpfs",
            } as Record<string, string>
          )[key] ?? key,
        ]),
      );
      const result = page.render({
        params,
        query: new URLSearchParams(),
        stores,
      });
      if (
        snapshots.some(
          (item) => item.adapter === adapter && item.path === page.path,
        )
      )
        continue;
      snapshots.push({
        adapter,
        name,
        path: page.path,
        source: relative(root, source),
        nodes: serializeNodes(Array.isArray(result) ? result : [result]),
      });
      const variants =
        adapter === "airflow" && name === "dagDetailPage"
          ? ["graph", "runs", "tasks", "code", "details"]
          : [];
      for (const tab of variants) {
        const result = page.render({
          params,
          query: new URLSearchParams({ tab }),
          stores,
        });
        snapshots.push({
          adapter,
          name: `${name}-${tab}`,
          path: `${page.path}?tab=${tab}`,
          source: relative(root, source),
          nodes: serializeNodes(Array.isArray(result) ? result : [result]),
        });
      }
    }
  }
}
process.stdout.write(JSON.stringify(snapshots));
