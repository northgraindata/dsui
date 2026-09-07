import { expect, test } from "bun:test";
import { definePage } from "../page/index";
import { defineResource } from "../resource/index";
import { defineAdapter } from "./define";

test("validates adapter identity", () => {
  expect(() =>
    defineAdapter({
      metadata: { id: "Bad Id", name: "X", version: "1.0.0" },
    }),
  ).toThrow();
  expect(() =>
    defineAdapter({
      metadata: { id: "ok", name: "X", version: "not-semver" },
    }),
  ).toThrow();
  expect(() =>
    defineAdapter({ metadata: { id: "ok", name: "", version: "1.0.0" } }),
  ).toThrow();
});

test("accepts a minimal one-file adapter", () => {
  const adapter = defineAdapter({
    metadata: { id: "hello", name: "Hello", version: "1.0.0" },
    pages: [definePage({ path: "/", render: () => [] })],
  });
  expect(adapter.kind).toBe("adapter");
  expect(adapter.sdkVersion).toBe("0.2.0");
  expect(adapter.pages).toHaveLength(1);
});

test("rejects duplicate resource ids and page paths", () => {
  const first = defineResource({ id: "dup", query: () => 1 });
  const second = defineResource({ id: "dup", query: () => 2 });
  expect(() =>
    defineAdapter({
      metadata: { id: "a", name: "A", version: "1.0.0" },
      resources: [first, second],
    }),
  ).toThrow();
  expect(() =>
    defineAdapter({
      metadata: { id: "a", name: "A", version: "1.0.0" },
      pages: [
        definePage({ path: "/x", render: () => [] }),
        definePage({ path: "/x", render: () => [] }),
      ],
    }),
  ).toThrow();
});
