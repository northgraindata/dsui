import { expect, test } from "bun:test";
import { RemoteBackend } from "./loader.js";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("DuckDB backend runs concurrent requests one at a time", async () => {
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
      true,
    );
  const firstBackend = createBackend();
  const secondBackend = createBackend();

  const [first, second] = await Promise.all([
    firstBackend.executeResource("first", {}, {}),
    secondBackend.executeResource("second", {}, {}),
  ]);

  expect(first.data).toBe("first");
  expect(second.data).toBe("second");
  expect(maxActive).toBe(1);
  expect(started).toEqual(["first", "second"]);
});

test("DuckDB request failure does not block later requests", async () => {
  let calls = 0;
  const backend = new RemoteBackend(
    {
      async request({ target }) {
        calls += 1;
        if (calls === 1) throw new Error("host failed");
        return { data: target };
      },
    },
    true,
  );

  const failed = backend.executeResource("first", {}, {});
  const succeeding = backend.executeResource("second", {}, {});
  const [failure, result] = await Promise.allSettled([failed, succeeding]);

  expect(failure.status).toBe("rejected");
  expect(result).toEqual({ status: "fulfilled", value: { data: "second" } });
  expect(calls).toBe(2);
});

test("other adapter backends retain concurrent requests", async () => {
  let active = 0;
  let maxActive = 0;
  const backend = new RemoteBackend({
    async request({ target }) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await pause(10);
      active -= 1;
      return { data: target };
    },
  });

  await Promise.all([
    backend.executeResource("first", {}, {}),
    backend.executeResource("second", {}, {}),
  ]);

  expect(maxActive).toBe(2);
});
