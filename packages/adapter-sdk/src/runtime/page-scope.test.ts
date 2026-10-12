import { expect, spyOn, test } from "bun:test";
import { definePage } from "../page";
import { defineStore } from "../store";
import { createPageScope } from "./page-scope";
import { StoreRegistry } from "./store-registry";

test("page scope subscribes once and releases adapter store subscriptions on disposal", async () => {
  const definition = defineStore({
    id: "state",
    scope: "adapter",
    state: { value: 0 },
    actions: ({ set }) => ({ increment: () => set({ value: 1 }) }),
  });
  const page = definePage({
    path: "/",
    stores: [definition],
    render: ({ stores }) => {
      stores.use(definition);
      stores.use(definition);
      return [];
    },
  });
  const registry = new StoreRegistry({ stores: [definition], pages: [page] });
  const store = registry.adapterStore(definition);
  const original = store.subscribe.bind(store);
  let releases = 0;
  const subscription = spyOn(store, "subscribe").mockImplementation(
    (listener) => {
      const unsubscribe = original(listener);
      return () => {
        releases++;
        unsubscribe();
      };
    },
  );
  try {
    const scope = createPageScope(registry, page, {});
    await scope.ready();
    scope.render();
    scope.render();
    expect(subscription).toHaveBeenCalledTimes(1);
    scope.dispose();
    scope.dispose();
    expect(releases).toBe(1);
    const next = createPageScope(registry, page, {});
    await next.ready();
    next.render();
    expect(subscription).toHaveBeenCalledTimes(2);
    next.dispose();
    expect(releases).toBe(2);
  } finally {
    subscription.mockRestore();
    registry.dispose();
  }
});
