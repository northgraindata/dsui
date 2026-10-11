import { expect, test } from "bun:test";
import { withWebBasePath } from "../src/web-path";

test("web paths stay at root when no base path is configured", () => {
  expect(withWebBasePath("/api/v1/adapters", "/")).toBe("/api/v1/adapters");
});

test("web paths include the configured prefix", () => {
  expect(withWebBasePath("/api/v1/adapters", "/demo/")).toBe(
    "/demo/api/v1/adapters",
  );
});

test("web paths normalize a prefix without a leading slash", () => {
  expect(withWebBasePath("api/v1/adapters", "demo")).toBe(
    "/demo/api/v1/adapters",
  );
});
