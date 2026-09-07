import { expect, test } from "bun:test";
import { z } from "zod";
import { type ActionRuntimeContext, defineAction } from "../action/index";
import { defineAdapter } from "../adapter/index";
import { PageHeader, Table } from "../components/index";
import { definePage } from "../page/index";
import { poll } from "../refresh/index";
import { defineResource } from "../resource/index";
import { defineStore } from "../store/index";
import { createAdapterInstance, type ResourceResult } from "./index";

interface Ctx {
  values: string[];
  failNext?: boolean;
  calls: number;
}

const sessionStore = defineStore({
  id: "session",
  scope: "adapter",
  state: { warehouse: null as string | null },
  actions: ({ set }) => ({
    setWarehouse: (warehouse: string | null) => set({ warehouse }),
  }),
});

const filtersStore = defineStore({
  id: "filters",
  scope: "page",
  state: { search: "" },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
  }),
});

function testAdapter(overrides: Partial<Ctx> = {}) {
  const ctx: Ctx = { values: ["a", "b"], calls: 0, ...overrides };
  const items = defineResource({
    id: "items",
    input: z.object({ search: z.string().default("") }),
    query: (input, c: Ctx) => {
      c.calls++;
      if (c.failNext) throw new Error("boom");
      return c.values.filter((v) => v.includes(input.search));
    },
    refresh: poll(20),
  });
  const refreshItems = defineAction({
    id: "refresh-items",
    run: (_input: undefined, c: Ctx & ActionRuntimeContext) => {
      c.values.push("c");
      c.invalidate(items);
      return "refreshed";
    },
  });
  const adapter = defineAdapter<Ctx, Record<string, never>>({
    metadata: { id: "test", name: "Test", version: "1.0.0" },
    context: () => ctx,
    disposeContext: (c) => {
      c.values.length = 0;
    },
    stores: [sessionStore, filtersStore],
    resources: [items],
    actions: [refreshItems],
    pages: [
      definePage({
        path: "/items",
        stores: [filtersStore],
        render: ({ stores }) => {
          const filters = stores.use(filtersStore);
          return [
            PageHeader({ title: "Items" }),
            Table({ source: items({ search: filters.search }) }),
          ];
        },
      }),
    ],
  });
  return { adapter, ctx, items, refreshItems };
}

test("executeResource returns success and error results", async () => {
  const { adapter, items } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  const ok = await instance.executeResource(items({ search: "a" }));
  expect(ok).toEqual({ status: "success", data: ["a"] });
  const failing = testAdapter({ failNext: true });
  const failingInstance = await createAdapterInstance(failing.adapter);
  const err = await failingInstance.executeResource(
    failing.items({ search: "" }),
  );
  expect(err.status).toBe("error");
  await instance.dispose();
  await failingInstance.dispose();
});

test("watchResource polls and stops after unwatch", async () => {
  const { adapter, ctx, items } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  const results: ResourceResult<string[]>[] = [];
  const unwatch = instance.watchResource(items({ search: "" }), (r) =>
    results.push(r),
  );
  await new Promise((resolve) => setTimeout(resolve, 75));
  unwatch();
  const callsAfterStop = ctx.calls;
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(ctx.calls).toBe(callsAfterStop);
  expect(results.length).toBeGreaterThanOrEqual(2);
  expect(results[0]).toEqual({ status: "success", data: ["a", "b"] });
  await instance.dispose();
});

test("independent bindings poll independently", async () => {
  const { adapter, ctx, items } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  const unwatchA = instance.watchResource(items({ search: "a" }), () => {});
  const unwatchB = instance.watchResource(items({ search: "b" }), () => {});
  await new Promise((resolve) => setTimeout(resolve, 50));
  unwatchA();
  unwatchB();
  // Both bindings executed at least once each, plus polls.
  expect(ctx.calls).toBeGreaterThanOrEqual(2);
  await instance.dispose();
});

test("invalidate re-executes watchers", async () => {
  const { adapter, ctx, items } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  const seen: string[][] = [];
  const unwatch = instance.watchResource(items({ search: "" }), (r) => {
    if (r.status === "success") seen.push(r.data);
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const before = ctx.calls;
  instance.invalidate(items);
  await new Promise((resolve) => setTimeout(resolve, 10));
  unwatch();
  expect(ctx.calls).toBeGreaterThan(before);
  expect(seen.length).toBeGreaterThanOrEqual(2);
  await instance.dispose();
});

test("actions can invalidate resources via context", async () => {
  const { adapter, ctx, items, refreshItems } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  const seen: string[][] = [];
  const unwatch = instance.watchResource(items({ search: "" }), (r) => {
    if (r.status === "success") seen.push(r.data);
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const result = await instance.executeAction(refreshItems());
  expect(result).toEqual({ status: "success", data: "refreshed" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  unwatch();
  expect(ctx.values).toContain("c");
  expect(seen[seen.length - 1]).toContain("c");
  await instance.dispose();
});

test("action errors are returned, not thrown", async () => {
  const failing = defineAction({
    id: "failing",
    run: () => {
      throw new Error("nope");
    },
  });
  const adapter = defineAdapter({
    metadata: { id: "t", name: "T", version: "1.0.0" },
    context: () => ({}),
    actions: [failing],
  });
  const instance = await createAdapterInstance(adapter);
  const result = await instance.executeAction(failing());
  expect(result.status).toBe("error");
  await instance.dispose();
});

test("two instances stay isolated", async () => {
  const first = testAdapter();
  const second = testAdapter();
  const a = await createAdapterInstance(first.adapter);
  const b = await createAdapterInstance(second.adapter);
  a.store(sessionStore).actions.setWarehouse("WH_A");
  expect(b.store(sessionStore).get().warehouse).toBeNull();
  expect(first.ctx.values).not.toBe(second.ctx.values);
  await a.dispose();
  expect(first.ctx.values).toHaveLength(0);
  expect(second.ctx.values).toHaveLength(2);
  await b.dispose();
});

test("page scope renders with params and reacts to store changes", async () => {
  const { adapter } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  const scope = instance.createPageScope("/items");
  expect(scope.params).toEqual({});
  const first = scope.render();
  const firstNodes = Array.isArray(first) ? first : [first];
  expect(firstNodes[0]).toMatchObject({ kind: "page-header" });

  let updates = 0;
  const off = scope.onUpdate(() => updates++);
  const filters = scope.stores.use(filtersStore);
  filters.setSearch("a");
  expect(updates).toBeGreaterThanOrEqual(1);
  const second = scope.render();
  const secondNodes = Array.isArray(second) ? second : [second];
  const table = secondNodes[1];
  expect(table?.kind).toBe("table");
  if (table?.kind === "table")
    expect(table.props.source?.input).toEqual({ search: "a" });
  off();
  scope.dispose();
  await instance.dispose();
});

test("page scope disposal destroys page stores only", async () => {
  const { adapter } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  instance.store(sessionStore).actions.setWarehouse("KEEP");
  const scope = instance.createPageScope("/items");
  scope.stores.use(filtersStore).setSearch("x");
  scope.dispose();
  // Adapter-scoped state survives page disposal.
  expect(instance.store(sessionStore).get().warehouse).toBe("KEEP");
  await instance.dispose();
});

test("unknown urls throw", async () => {
  const { adapter } = testAdapter();
  const instance = await createAdapterInstance(adapter);
  expect(() => instance.createPageScope("/nope")).toThrow();
  await instance.dispose();
});

test("connection schema is validated per instance", async () => {
  const adapter = defineAdapter({
    metadata: { id: "guarded", name: "G", version: "1.0.0" },
    connectionSchema: z.object({ token: z.string().min(1) }),
    context: (config) => ({ token: config.token }),
  });
  await expect(createAdapterInstance(adapter, {})).rejects.toThrow();
  const instance = await createAdapterInstance(adapter, { token: "s3cret" });
  expect(instance.context).toEqual({ token: "s3cret" });
  await instance.dispose();
});
