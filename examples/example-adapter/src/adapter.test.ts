import { expect, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import adapter from "./adapter";

test("example adapter renders its overview page", async () => {
  const instance = await createAdapterInstance(adapter, {
    baseUrl: "http://localhost:4192",
  });
  const scope = instance.createPageScope("/");
  const rendered = scope.render();
  const nodes = Array.isArray(rendered) ? rendered : [rendered];
  expect(nodes.length).toBeGreaterThan(0);
  await instance.dispose();
});
