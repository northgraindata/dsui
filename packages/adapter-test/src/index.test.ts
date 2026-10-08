import { expect, test } from "bun:test";
import {
  type AdapterInstance,
  defineAction,
  defineAdapter,
  defineResource,
  defineStore,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { createAdapterTest, withAdapterTest } from "./index";

const counter = defineStore({
  id: "counter",
  scope: "adapter",
  state: { value: 0 },
  actions: (store) => ({
    increment: () => store.set({ value: store.get().value + 1 }),
  }),
});

const readValue = defineResource({
  id: "read-value",
  input: z.object({ key: z.string() }),
  query: ({ key }, context: { value: string }) => `${key}:${context.value}`,
});

const setValue = defineAction({
  id: "set-value",
  input: z.object({ value: z.string() }),
  run: ({ value }, context: { value: string }) => {
    context.value = value;
    return context.value;
  },
});

type TestConfig = { method: "test"; value: string };
let disposedContexts = 0;

const adapter = defineAdapter<{ value: string }, TestConfig>({
  metadata: { id: "test-adapter", name: "Test adapter", version: "1.0.0" },
  connectionMethods: {
    test: {
      label: "Test",
      schema: z.object({ value: z.string().default("initial") }),
    },
  },
  context: (config) => ({ value: config.value }),
  disposeContext: () => {
    disposedContexts += 1;
  },
  health: async () => ({
    status: "healthy",
    score: 100,
    checks: [],
  }),
  stores: [counter],
  resources: [readValue],
  actions: [setValue],
});

test("creates an isolated, validated adapter runtime", async () => {
  const first = await createAdapterTest(adapter, {
    method: "test",
    value: "one",
  });
  const second = await createAdapterTest(adapter, {
    method: "test",
    value: "two",
  });

  expect(first.context).toEqual({ value: "one" });
  expect(second.context).toEqual({ value: "two" });
  expect(first.instance.store(counter).get()).toEqual({ value: 0 });
  expect(second.instance.store(counter).get()).toEqual({ value: 0 });

  await first.dispose();
  await second.dispose();
});

test("executes resources and actions through the SDK runtime", async () => {
  await withAdapterTest(
    adapter,
    { method: "test", value: "before" },
    async (test) => {
      const resource = await test.instance.executeResource(
        readValue({ key: "item" }),
      );
      expect(resource).toEqual({ status: "success", data: "item:before" });

      const action = await test.instance.executeAction(
        setValue({ value: "after" }),
      );
      expect(action).toEqual({ status: "success", data: "after" });
      expect(test.context).toEqual({ value: "before" });
    },
  );
});

test("disposes the runtime after the callback fails", async () => {
  let testInstance: AdapterInstance<{ value: string }> | undefined;
  const disposedBefore = disposedContexts;
  await expect(
    withAdapterTest(adapter, { method: "test" }, async (test) => {
      testInstance = test.instance;
      throw new Error("expected failure");
    }),
  ).rejects.toThrow("expected failure");

  expect(testInstance).toBeDefined();
  expect(disposedContexts).toBe(disposedBefore + 1);
});
