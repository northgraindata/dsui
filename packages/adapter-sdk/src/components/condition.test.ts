import { describe, expect, it } from "bun:test";
import {
  type ConditionSpec,
  isRowActionDisabled,
  matchesWhen,
} from "./condition";

describe("table condition matcher (matchesWhen & isRowActionDisabled)", () => {
  it("returns true when condition is absent (undefined or null)", () => {
    const row = { id: 1, status: "active" };
    expect(matchesWhen(row, undefined)).toBe(true);
    expect(matchesWhen(row, null as unknown as ConditionSpec)).toBe(true);
  });

  it("handles missing fields correctly", () => {
    const row = { id: 1 };
    expect(matchesWhen(row, { field: "nonexistent", equals: "active" })).toBe(
      false,
    );
    expect(
      matchesWhen(row, { field: "nonexistent", notEquals: "active" }),
    ).toBe(true);
  });

  it("correctly matches falsy values (0, false, empty string)", () => {
    const row = { count: 0, active: false, name: "" };

    expect(matchesWhen(row, { field: "count", equals: 0 })).toBe(true);
    expect(matchesWhen(row, { field: "count", notEquals: 0 })).toBe(false);

    expect(matchesWhen(row, { field: "active", equals: false })).toBe(true);
    expect(matchesWhen(row, { field: "active", notEquals: false })).toBe(false);

    expect(matchesWhen(row, { field: "name", equals: "" })).toBe(true);
    expect(matchesWhen(row, { field: "name", notEquals: "" })).toBe(false);
  });

  it("enforces type-sensitive strict equality", () => {
    const row = { count: 0, active: false, id: "100" };

    // String "0" vs number 0
    expect(matchesWhen(row, { field: "count", equals: "0" })).toBe(false);
    expect(matchesWhen(row, { field: "count", notEquals: "0" })).toBe(true);

    // Number 0 vs boolean false
    expect(matchesWhen(row, { field: "active", equals: 0 })).toBe(false);
    expect(matchesWhen(row, { field: "active", notEquals: 0 })).toBe(true);

    // String "100" vs number 100
    expect(matchesWhen(row, { field: "id", equals: 100 })).toBe(false);
    expect(matchesWhen(row, { field: "id", notEquals: 100 })).toBe(true);
  });

  it("supports conditions specifying both equals and notEquals operators", () => {
    const row = { status: "active" };

    expect(
      matchesWhen(row, {
        field: "status",
        equals: "active",
        notEquals: "disabled",
      }),
    ).toBe(true);

    expect(
      matchesWhen(row, {
        field: "status",
        equals: "active",
        notEquals: "active",
      }),
    ).toBe(false);
  });

  it("isRowActionDisabled returns false when disabledWhen is absent", () => {
    const row = { status: "active" };
    expect(isRowActionDisabled(row, undefined)).toBe(false);
    expect(isRowActionDisabled(row, null as unknown as ConditionSpec)).toBe(
      false,
    );
  });

  it("isRowActionDisabled evaluates condition when disabledWhen is provided", () => {
    const activeRow = { status: "active" };
    const disabledRow = { status: "disabled" };

    const disabledCondition: ConditionSpec = {
      field: "status",
      equals: "disabled",
    };

    expect(isRowActionDisabled(activeRow, disabledCondition)).toBe(false);
    expect(isRowActionDisabled(disabledRow, disabledCondition)).toBe(true);
  });
});
