import { describe, expect, test } from "bun:test";
import { defineAdapter } from "../adapter/index";
import { InvalidDefinitionError } from "../shared/errors";
import {
  DATASET_OBSERVE_MAX_REFS,
  type DatasetsCapability,
  datasetListInputSchema,
  datasetObservationSchema,
  datasetObserveInputSchema,
  datasetPageSchema,
  defineDatasets,
} from "./index";

const health = async () => ({
  status: "healthy" as const,
  score: 100,
  checks: [],
});

const capability: DatasetsCapability<{ rows: number }> = {
  list: () => ({
    items: [{ ref: { name: "public.orders" }, kind: "table" }],
  }),
  observe: (refs, ctx) =>
    refs.map((ref) => ({
      ref,
      at: "2026-11-19T10:00:00.000Z",
      rowCount: ctx.rows,
    })),
};

function adapter(datasets?: DatasetsCapability<{ rows: number }>) {
  return defineAdapter({
    metadata: { id: "demo", name: "Demo", version: "1.0.0" },
    context: () => ({ rows: 42 }),
    health,
    ...(datasets ? { datasets } : {}),
  });
}

describe("datasets capability", () => {
  test("is absent unless the adapter declares it", () => {
    expect(adapter().datasets).toBeUndefined();
  });

  test("is carried on the definition and called with the context", async () => {
    const definition = adapter(capability);
    const ctx = await definition.createContext({});
    const observed = await definition.datasets?.observe(
      [{ name: "public.orders" }],
      ctx,
    );
    expect(observed).toEqual([
      {
        ref: { name: "public.orders" },
        at: "2026-11-19T10:00:00.000Z",
        rowCount: 42,
      },
    ]);
  });

  test("rejects a capability without both reads", () => {
    expect(() =>
      defineDatasets({ list: capability.list } as DatasetsCapability),
    ).toThrow(InvalidDefinitionError);
  });
});

describe("dataset schemas", () => {
  test("list input defaults the page size and enforces the ceiling", () => {
    expect(datasetListInputSchema.parse({}).limit).toBe(500);
    expect(datasetListInputSchema.safeParse({ limit: 1_001 }).success).toBe(
      false,
    );
    expect(datasetListInputSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  test("kind is an open kebab-case string", () => {
    const page = (kind: string) =>
      datasetPageSchema.safeParse({
        items: [{ ref: { name: "x" }, kind }],
      }).success;
    expect(page("table")).toBe(true);
    expect(page("materialized-view")).toBe(true);
    expect(page("topic")).toBe(true);
    expect(page("Table")).toBe(false);
    expect(page("")).toBe(false);
  });

  test("an observation needs a time but no particular measure", () => {
    const ref = { name: "x" };
    expect(
      datasetObservationSchema.safeParse({
        ref,
        at: "2026-11-19T10:00:00Z",
      }).success,
    ).toBe(true);
    expect(datasetObservationSchema.safeParse({ ref }).success).toBe(false);
    expect(
      datasetObservationSchema.safeParse({ ref, at: "yesterday" }).success,
    ).toBe(false);
  });

  test("measures cannot be negative or fractional", () => {
    const base = { ref: { name: "x" }, at: "2026-11-19T10:00:00Z" };
    for (const bad of [
      { rowCount: -1 },
      { rowCount: 1.5 },
      { bytes: -5 },
      { changeCounter: -1 },
    ])
      expect(
        datasetObservationSchema.safeParse({ ...base, ...bad }).success,
      ).toBe(false);
  });

  test("observe is bounded in both directions", () => {
    const refs = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ name: `t${index}` }));
    expect(datasetObserveInputSchema.safeParse({ refs: [] }).success).toBe(
      false,
    );
    expect(
      datasetObserveInputSchema.safeParse({
        refs: refs(DATASET_OBSERVE_MAX_REFS),
      }).success,
    ).toBe(true);
    expect(
      datasetObserveInputSchema.safeParse({
        refs: refs(DATASET_OBSERVE_MAX_REFS + 1),
      }).success,
    ).toBe(false);
  });
});
