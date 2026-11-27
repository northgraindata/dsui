import { describe, expect, test } from "bun:test";
import { humanizeKey, isTimestamp, valueText } from "./format-value";

describe("humanizeKey", () => {
  test("labels identifiers and keeps acronyms", () => {
    expect(humanizeKey("isPaused")).toBe("Is paused");
    expect(humanizeKey("dagId")).toBe("DAG ID");
    expect(humanizeKey("consumingDags")).toBe("Consuming DAGs");
    expect(humanizeKey("total_rows")).toBe("Total rows");
  });

  test("leaves written labels and data keys alone", () => {
    for (const key of ["Data size", "env.prod", "my-key", "Engine"])
      expect(humanizeKey(key)).toBe(key);
  });
});

describe("values", () => {
  test("reads without raw data", () => {
    expect(valueText(true)).toBe("Yes");
    expect(valueText("")).toBe("—");
    expect(valueText([])).toBe("—");
    expect(valueText(["a", "b"])).toBe("a, b");
    expect(valueText({ owner: "data", retries: 2 })).toBe(
      "owner: data, retries: 2",
    );
    expect(valueText(0)).toBe("0");
  });

  test("only treats zoned date times as timestamps", () => {
    expect(isTimestamp("2026-01-01T10:15:00Z")).toBe(true);
    expect(isTimestamp("2026-01-01T10:15:00.123+02:00")).toBe(true);
    expect(isTimestamp("2026-01-01 10:15:00")).toBe(false);
    expect(isTimestamp("2026-01-01")).toBe(false);
  });
});
