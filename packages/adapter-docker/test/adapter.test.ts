import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires a container", () => {
  expect(() => adapter.connectionSchema.parse({})).toThrow();
  expect(() =>
    adapter.connectionSchema.parse({ container: "generator" }),
  ).not.toThrow();
});

test("defaults to the cli strategy", () => {
  const parsed = adapter.connectionSchema.parse({ container: "generator" });
  expect(parsed.strategy).toBe("cli");
});

test("exposes logs and service-info capabilities", () => {
  const ids = adapter.capabilities.map((c) => c.id);
  expect(ids).toContain("logs");
  expect(ids).toContain("service-info");
});

test("logs capability renders as a log stream", () => {
  const logs = adapter.capabilities.find((c) => c.id === "logs");
  expect(logs?.view.kind).toBe("log-stream");
});
