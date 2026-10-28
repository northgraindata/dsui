import { expect, test } from "bun:test";
import { keyedItems } from "./keyed-items";

test("declarative sibling identity survives insertion and reordering", () => {
  const a = { kind: "text", props: { value: "A" } };
  const b = { kind: "text", props: { value: "B" } };
  const original = keyedItems([a, b]);
  const changed = keyedItems([{ kind: "text", props: { value: "New" } }, b, a]);
  expect(changed[1].key).toBe(original[1].key);
  expect(changed[2].key).toBe(original[0].key);
  expect(keyedItems([structuredClone(a)])[0].key).toBe(original[0].key);
});

test("identical siblings still have distinct keys", () => {
  const items = keyedItems([{ value: "same" }, { value: "same" }]);
  expect(items[0].key).not.toBe(items[1].key);
});

test("record IDs preserve identity when resource fields change", () => {
  const before = keyedItems([{ id: "warehouse", status: "loading" }]);
  const after = keyedItems([{ id: "warehouse", status: "healthy" }]);
  expect(after[0].key).toBe(before[0].key);
});
