import { expect, test } from "bun:test";
import { checkAdapter } from "@northgraindata/dsui-adapter-test";
import adapter from "../src/adapter";

test("declares a conformant adapter", async () => {
  const results = await checkAdapter(adapter, {
    endpoint: "https://example.test",
    token: "test",
  });
  expect(results.every((result) => result.ok)).toBe(true);
});
