import { describe, expect, test } from "bun:test";
import { csvRecords, parseCsv } from "../src/csv.js";

describe("parseCsv", () => {
  test("reads header and rows", () => {
    expect(parseCsv("a,b\n1,2\n3,4\n")).toEqual({
      columns: ["a", "b"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
      truncated: false,
    });
  });

  test("handles quotes, embedded commas, newlines and CRLF", () => {
    const parsed = parseCsv('a,b\r\n"x,y","line1\nline2"\r\n"say ""hi""",\r\n');
    expect(parsed.rows).toEqual([
      ["x,y", "line1\nline2"],
      ['say "hi"', ""],
    ]);
  });

  test("keeps an unterminated last line", () => {
    expect(parseCsv("a\n1").rows).toEqual([["1"]]);
  });

  test("rejects a result cut inside a quoted value", () => {
    expect(() => parseCsv('a\n"unfinished')).toThrow("quoted");
  });

  test("limits rows and reports truncation", () => {
    const parsed = parseCsv("a\n1\n2\n3\n", 2);
    expect(parsed.rows).toEqual([["1"], ["2"]]);
    expect(parsed.truncated).toBe(true);
  });

  test("returns an empty table for empty input", () => {
    expect(parseCsv("")).toEqual({ columns: [], rows: [], truncated: false });
  });

  test("maps rows to records", () => {
    expect(csvRecords({ columns: ["a", "b"], rows: [["1"]] })).toEqual([
      { a: "1", b: "" },
    ]);
  });
});
