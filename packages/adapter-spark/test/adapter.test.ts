import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires a history server URL", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
});

test("exposes inspect capabilities", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  expect(ids).toContain("applications");
  expect(ids).toContain("app-detail");
});
