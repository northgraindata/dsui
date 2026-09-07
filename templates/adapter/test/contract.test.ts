import { expect, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import adapter, { info, ping } from "../src/adapter";

const connection = { endpoint: "https://example.test", token: "test" };
// Unroutable endpoint: ping documents the error path deterministically.
const unreachable = { endpoint: "https://127.0.0.1:9", token: "test" };

test("declares a conformant adapter", () => {
  expect(adapter.metadata.id).toBe("example-service");
  expect(adapter.resources.map((resource) => resource.id)).toEqual(["info"]);
  expect(adapter.actions.map((action) => action.id)).toEqual(["ping"]);
  expect(adapter.pages.map((page) => page.path)).toEqual(["/"]);
});

test("executes resources and surfaces action errors", async () => {
  const instance = await createAdapterInstance(adapter, connection);
  try {
    const resource = await instance.executeResource(info());
    expect(resource).toEqual({
      status: "success",
      data: { endpoint: "https://example.test", status: "reachable" },
    });
  } finally {
    await instance.dispose();
  }
  const offline = await createAdapterInstance(adapter, unreachable);
  try {
    // Ping needs the network; the unroutable endpoint proves the
    // error union instead of a live success.
    const failed = await offline.executeAction(ping());
    expect(failed.status).toBe("error");
  } finally {
    await offline.dispose();
  }
});

test("rejects unknown routes", async () => {
  const instance = await createAdapterInstance(adapter, connection);
  try {
    expect(() => instance.createPageScope("/missing")).toThrow();
  } finally {
    await instance.dispose();
  }
});
