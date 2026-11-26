import {
  type AdapterDefinition,
  type PageNode,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
// The runtime is not public SDK API; fixtures reuse it so pages see real stores.
import { createPageScope, StoreRegistry } from "../../adapter-sdk/src/runtime";
import type { AdapterFixtures } from "./types";

type AnyAdapter = Pick<
  AdapterDefinition<unknown, unknown>,
  "metadata" | "pages" | "resources" | "stores"
>;

export function pageSlug(path: string): string {
  return path === "/"
    ? "index"
    : path.slice(1).replaceAll(":", "_").replaceAll("/", "~");
}

function pageParams(
  path: string,
  fixtures: AdapterFixtures,
): Record<string, string> {
  return Object.fromEntries(
    [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => {
      const name = match[1] ?? "";
      return [name, fixtures.params?.[name] ?? `sample_${name}`];
    }),
  );
}

/** Renders one adapter page exactly as the server does, without a connection. */
export async function renderPage(
  adapter: AnyAdapter,
  path: string,
  fixtures: AdapterFixtures,
): Promise<readonly PageNode[]> {
  const page = adapter.pages.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`Unknown page ${path}`);
  const registry = new StoreRegistry(adapter);
  const scope = createPageScope(
    registry,
    page,
    pageParams(path, fixtures),
    new URLSearchParams(fixtures.queries?.[path] ?? ""),
  );
  try {
    await registry.ready();
    await scope.ready();
    return serializeNodes(scope.render());
  } finally {
    scope.dispose();
    registry.dispose();
  }
}

/**
 * Collects the column ids that pages ask each resource for, so rows without a
 * declared shape still fill the columns on screen.
 */
export function collectColumns(
  value: unknown,
  into: Map<string, Set<string>>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectColumns(item, into);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const source = record.source as { resourceId?: unknown } | undefined;
  if (typeof source?.resourceId === "string" && Array.isArray(record.columns)) {
    const columns = into.get(source.resourceId) ?? new Set<string>();
    for (const column of record.columns as { id?: unknown }[])
      if (typeof column.id === "string") columns.add(column.id);
    into.set(source.resourceId, columns);
  }
  for (const item of Object.values(record)) collectColumns(item, into);
}
