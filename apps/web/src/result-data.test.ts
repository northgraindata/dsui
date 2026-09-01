import { describe, expect, it } from "vitest";
import { rowsToRecords } from "./result-data";

describe("operation result normalization", () => {
  it("maps positional rows to named records", () => {
    expect(
      rowsToRecords(
        [
          ["analytics", "events"],
          ["default", "users"],
        ],
        ["database", "name"],
      ),
    ).toEqual([
      { database: "analytics", name: "events" },
      { database: "default", name: "users" },
    ]);
  });

  it("preserves object rows and ignores malformed values", () => {
    expect(rowsToRecords([{ name: "events" }, null, "bad"], [])).toEqual([
      { name: "events" },
    ]);
  });
});
