import { expect, test } from "bun:test";
import { createStoreInstance, defineStore } from "./index";

const sessionStore = defineStore({
  id: "session",
  scope: "adapter",
  state: { role: null as string | null, warehouse: null as string | null },
  actions: ({ set, reset }) => ({
    setRole: (role: string) => set({ role }),
    setWarehouse: (warehouse: string | null) => set({ warehouse }),
    clear: () => reset(),
  }),
});

test("exposes initial state", () => {
  const store = createStoreInstance(sessionStore);
  expect(store.get()).toEqual({ role: null, warehouse: null });
});

test("typed actions update state", () => {
  const store = createStoreInstance(sessionStore);
  store.actions.setRole("ANALYST");
  expect(store.get().role).toBe("ANALYST");
  store.actions.setWarehouse("ETL_WH");
  expect(store.get()).toEqual({ role: "ANALYST", warehouse: "ETL_WH" });
});

test("subscribers are notified with snapshots", () => {
  const store = createStoreInstance(sessionStore);
  const seen: unknown[] = [];
  const unsubscribe = store.subscribe((state) => seen.push(state));
  store.actions.setRole("ADMIN");
  unsubscribe();
  store.actions.setRole("OTHER");
  expect(seen).toEqual([{ role: "ADMIN", warehouse: null }]);
});

test("reset restores initial state", () => {
  const store = createStoreInstance(sessionStore);
  store.actions.setRole("ADMIN");
  store.actions.clear();
  expect(store.get()).toEqual({ role: null, warehouse: null });
});

test("state snapshots are isolated copies", () => {
  const store = createStoreInstance(sessionStore);
  const snapshot = store.get() as Record<string, unknown>;
  snapshot.role = "MUTATED";
  expect(store.get().role).toBeNull();
});

test("store instances are independent", () => {
  const first = createStoreInstance(sessionStore);
  const second = createStoreInstance(sessionStore);
  first.actions.setRole("ONE");
  expect(second.get().role).toBeNull();
});

test("destroy releases subscriptions", () => {
  const store = createStoreInstance(sessionStore);
  let calls = 0;
  store.subscribe(() => calls++);
  store.destroy();
  store.set({ role: "X" });
  expect(calls).toBe(0);
  expect(store.get().role).toBeNull();
});

test("rejects empty store ids", () => {
  expect(() =>
    defineStore({ id: "", scope: "page", state: {}, actions: () => ({}) }),
  ).toThrow();
});
