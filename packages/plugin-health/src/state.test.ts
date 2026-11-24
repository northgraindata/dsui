import { expect, test } from "bun:test";
import { advance, type StateCore } from "./state.js";

const thresholds = { failureThreshold: 2, recoveryThreshold: 3 };

function run(observed: Array<Parameters<typeof advance>[1]>) {
  let state: StateCore | null = null;
  const changes: Array<string | null> = [];
  observed.forEach((health, index) => {
    const result = advance(state, health, index * 1000, thresholds);
    state = result.next;
    if (result.changed) changes.push(`${result.from}>${result.next.health}`);
  });
  return { state: state as unknown as StateCore, changes };
}

test("the first observation is accepted as is", () => {
  expect(run(["unavailable"]).changes).toEqual(["null>unavailable"]);
});

test("one failure does not change a healthy service", () => {
  const { state, changes } = run(["healthy", "unavailable", "healthy"]);
  expect(state.health).toBe("healthy");
  expect(changes).toEqual(["null>healthy"]);
  expect(state.pending).toBeNull();
});

test("consecutive failures change state at the failure threshold", () => {
  const { state, changes } = run(["healthy", "unavailable", "unavailable"]);
  expect(state.health).toBe("unavailable");
  expect(state.since).toBe(2000);
  expect(changes).toEqual(["null>healthy", "healthy>unavailable"]);
});

test("recovery needs the recovery threshold, and a failure resets it", () => {
  const { state, changes } = run([
    "unavailable",
    "healthy",
    "healthy",
    "unavailable",
    "healthy",
    "healthy",
    "healthy",
  ]);
  expect(state.health).toBe("healthy");
  expect(changes).toEqual(["null>unavailable", "unavailable>healthy"]);
});

test("unknown results neither confirm nor count toward a change", () => {
  const { state } = run(["healthy", "unavailable", "unknown", "unavailable"]);
  expect(state.health).toBe("unavailable");
  const stays = run(["healthy", "unknown", "unknown", "unknown"]);
  expect(stays.state.health).toBe("healthy");
  expect(stays.changes).toEqual(["null>healthy"]);
});

test("moving between unhealthy states uses the failure threshold", () => {
  const { state, changes } = run(["warning", "unavailable", "unavailable"]);
  expect(state.health).toBe("unavailable");
  expect(changes).toEqual(["null>warning", "warning>unavailable"]);
});

test("a threshold of one changes state immediately", () => {
  let state: StateCore | null = null;
  state = advance(state, "healthy", 0, {
    failureThreshold: 1,
    recoveryThreshold: 1,
  }).next;
  const result = advance(state, "unavailable", 1, {
    failureThreshold: 1,
    recoveryThreshold: 1,
  });
  expect(result.changed).toBe(true);
});
