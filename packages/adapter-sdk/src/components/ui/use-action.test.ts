import { expect, test } from "bun:test";
import { fillTemplate } from "./use-action";

test("a confirmation names its object from the row", () => {
  expect(fillTemplate("Delete pool {name}?", { name: "default_pool" })).toBe(
    "Delete pool default_pool?",
  );
  expect(fillTemplate("Run {dag.id}", { dag: { id: "a" } })).toBe("Run a");
});

test("an unknown placeholder stays visible instead of reading undefined", () => {
  expect(fillTemplate("Delete {missing}?", {})).toBe("Delete {missing}?");
});
