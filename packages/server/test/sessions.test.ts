import { expect, test } from "bun:test";
import { SessionPool } from "../src/adapters/sessions";

test("closing keeps a service reserved until disposal finishes", async () => {
  const disposal = Promise.withResolvers<void>();
  let destroyed = 0;
  const pool = new SessionPool(
    async () => ({}),
    async () => {
      destroyed++;
      await disposal.promise;
    },
  );
  await pool.run("one", {}, async () => {});
  const first = pool.close("one");
  const second = pool.close("one");
  await expect(pool.run("one", {}, async () => {})).rejects.toThrow("closing");
  disposal.resolve();
  await Promise.all([first, second]);
  expect(destroyed).toBe(1);
  await pool.run("one", {}, async () => {});
  await pool.dispose();
});

test("sessions retain state and isolate equal configurations by service identity", async () => {
  let disposed = 0;
  const pool = new SessionPool(
    async () => ({ count: 0 }),
    async () => {
      disposed++;
    },
  );
  await pool.run("one", {}, async (state) => {
    state.count++;
  });
  expect(await pool.run("one", {}, async (state) => state.count)).toBe(1);
  expect(await pool.run("two", {}, async (state) => state.count)).toBe(0);
  await pool.dispose();
  expect(disposed).toBe(2);
  await expect(pool.run("one", {}, async () => 0)).rejects.toThrow("closed");
});

test("operations serialize and a failed operation does not poison the session", async () => {
  const pool = new SessionPool(
    async () => ({ count: 0 }),
    async () => {},
  );
  const increment = () =>
    pool.run("one", {}, async (state) => {
      const previous = state.count;
      await Promise.resolve();
      state.count = previous + 1;
    });
  await Promise.all([increment(), increment()]);
  await expect(
    pool.run("one", {}, async () => {
      throw new Error("failure");
    }),
  ).rejects.toThrow("failure");
  expect(await pool.run("one", {}, async (state) => state.count)).toBe(2);
  await pool.dispose();
});

test("capacity is bounded and closing a service frees its slot", async () => {
  const pool = new SessionPool(
    async () => ({}),
    async () => {},
    1,
  );
  await pool.run("one", {}, async () => {});
  await expect(pool.run("two", {}, async () => {})).rejects.toThrow("capacity");
  await pool.close("one");
  await pool.run("two", {}, async () => {});
  await pool.dispose();
});

test("configuration changes dispose the old state before using the new one", async () => {
  const events: string[] = [];
  const pool = new SessionPool(
    async (config) => {
      events.push("create");
      return config;
    },
    async () => {
      events.push("dispose");
    },
  );
  await pool.run("one", { path: "a" }, async () => {});
  await pool.run("one", { path: "b" }, async () => {});
  expect(events).toEqual(["create", "dispose", "create"]);
  await pool.dispose();
});
