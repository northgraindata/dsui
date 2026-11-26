import { describe, expect, test } from "bun:test";
import { labelledColumns } from "./run-grid";

describe("run grid time labels", () => {
  test("print the selected run and a few others, never crowded", () => {
    for (let selected = 0; selected < 52; selected += 1)
      for (const hovered of [undefined, 0, 20, 51]) {
        const columns = [...labelledColumns(52, selected, hovered)].sort(
          (a, b) => a - b,
        );
        expect(columns).toContain(hovered ?? selected);
        expect(columns.length).toBeGreaterThanOrEqual(3);
        for (let index = 1; index < columns.length; index += 1)
          expect(
            (columns[index] ?? 0) - (columns[index - 1] ?? 0),
          ).toBeGreaterThanOrEqual(7);
      }
  });
});
