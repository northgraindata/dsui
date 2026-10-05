import { expect, test } from "bun:test";
import { RemoteBackend } from "./loader.js";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("serial connection methods queue calls across backend instances", async () => {
  let active = 0;
  let maxActive = 0;
  const started: (string | undefined)[] = [];
  const createBackend = () =>
    new RemoteBackend(
      {
        async request({ target }) {
          started.push(target);
          active += 1;
          maxActive = Math.max(maxActive, active);
          await pause(10);
          active -= 1;
          return { data: target };
        },
      },
      "test-adapter",
      [{ id: "file", requestConcurrency: "serial" }],
    );
  const firstBackend = createBackend();
  const secondBackend = createBackend();

  const [first, second] = await Promise.all([
    firstBackend.executeResource("first", { method: "file" }, {}),
    secondBackend.executeResource("second", { method: "file" }, {}),
  ]);

  expect(first.data).toBe("first");
  expect(second.data).toBe("second");
  expect(maxActive).toBe(1);
  expect(started).toEqual(["first", "second"]);
});

test("a failed serial request does not block later requests", async () => {
  let calls = 0;
  const backend = new RemoteBackend(
    {
      async request({ target }) {
        calls += 1;
        if (calls === 1) throw new Error("host failed");
        return { data: target };
      },
    },
    "test-adapter",
    [{ id: "file", requestConcurrency: "serial" }],
  );

  const failed = backend.executeResource("first", { method: "file" }, {});
  const succeeding = backend.executeResource("second", { method: "file" }, {});
  const [failure, result] = await Promise.allSettled([failed, succeeding]);

  expect(failure.status).toBe("rejected");
  expect(result).toEqual({ status: "fulfilled", value: { data: "second" } });
  expect(calls).toBe(2);
});

test("parallel connection methods retain concurrent requests", async () => {
  let active = 0;
  let maxActive = 0;
  const backend = new RemoteBackend(
    {
      async request({ target }) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await pause(10);
        active -= 1;
        return { data: target };
      },
    },
    "test-adapter",
    [{ id: "remote", requestConcurrency: "parallel" }],
  );

  await Promise.all([
    backend.executeResource("first", { method: "remote" }, {}),
    backend.executeResource("second", { method: "remote" }, {}),
  ]);

  expect(maxActive).toBe(2);
});
