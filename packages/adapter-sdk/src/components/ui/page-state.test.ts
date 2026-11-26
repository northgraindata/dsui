import { describe, expect, test } from "bun:test";
import {
  initialPageState,
  lastOffset,
  pageRequest,
  pageSummary,
  readPage,
} from "./page-state";

describe("paged views", () => {
  test("sends the page with the source's own input", () => {
    expect(
      pageRequest(
        { dagId: "a" },
        {
          ...initialPageState(),
          offset: 50,
          search: " rev ",
          filters: { state: "failed", status: "" },
        },
      ),
    ).toEqual({
      dagId: "a",
      state: "failed",
      limit: 25,
      offset: 50,
      search: "rev",
    });
  });

  test("accepts only a page", () => {
    expect(readPage([{ id: 1 }])).toBeUndefined();
    expect(readPage({ items: [{ id: 1 }, null], total: 9 })).toEqual({
      items: [{ id: 1 }],
      total: 9,
    });
  });

  test("describes the page and finds the last one", () => {
    expect(pageSummary(25, 25, 1284)).toBe("26–50 of 1,284");
    expect(pageSummary(0, 0, 0)).toBe("0 results");
    expect(lastOffset(50, 25)).toBe(25);
    expect(lastOffset(51, 25)).toBe(50);
    expect(lastOffset(0, 25)).toBe(0);
  });
});
