import { describe, expect, test } from "bun:test";
import {
  actionId,
  isRowActionDisabled,
  matchesWhen,
  resolveLink,
} from "./table.js";

describe("resolveLink", () => {
  test("substitutes row values into path params", () => {
    expect(
      resolveLink("/dags/:dagId", { dagId: "dagId" }, { dagId: "example" }),
    ).toBe("/dags/example");
  });

  test("returns null when the row field is missing", () => {
    expect(resolveLink("/dags/:dagId", { dagId: "dagId" }, {})).toBeNull();
  });

  test("returns null when the row field is an empty string", () => {
    expect(
      resolveLink("/dags/:dagId", { dagId: "dagId" }, { dagId: "" }),
    ).toBeNull();
  });
});

describe("matchesWhen", () => {
  test("matches an absent condition", () => {
    expect(matchesWhen({ a: 1 }, undefined)).toBe(true);
  });

  test("matches equals and rejects mismatches", () => {
    expect(
      matchesWhen({ isPaused: false }, { field: "isPaused", equals: false }),
    ).toBe(true);
    expect(
      matchesWhen({ isPaused: true }, { field: "isPaused", equals: false }),
    ).toBe(false);
  });

  test("matches notEquals", () => {
    expect(
      matchesWhen(
        { state: "success" },
        { field: "state", notEquals: "running" },
      ),
    ).toBe(true);
    expect(
      matchesWhen(
        { state: "running" },
        { field: "state", notEquals: "running" },
      ),
    ).toBe(false);
  });
});

describe("isRowActionDisabled", () => {
  test("is enabled without a disabledWhen condition", () => {
    expect(isRowActionDisabled({ canRestart: false }, undefined)).toBe(false);
    expect(isRowActionDisabled({ canRestart: true }, undefined)).toBe(false);
  });

  test("disables exactly when the condition matches", () => {
    const condition = { field: "canRestart", equals: false };
    expect(isRowActionDisabled({ canRestart: false }, condition)).toBe(true);
    expect(isRowActionDisabled({ canRestart: true }, condition)).toBe(false);
  });
});

describe("actionId", () => {
  test("passes string ids through", () => {
    expect(actionId("trigger-dag")).toBe("trigger-dag");
  });

  test("reads serialized actionId references from browser nodes", () => {
    expect(actionId({ actionId: "trigger-dag" } as never)).toBe("trigger-dag");
  });

  test("reads raw definition ids", () => {
    expect(actionId({ id: "trigger-dag" } as never)).toBe("trigger-dag");
  });

  test("throws when no id is present", () => {
    expect(() => actionId({} as never)).toThrow("Table action is missing");
    expect(() => actionId(undefined)).toThrow("Table action is missing");
  });
});
