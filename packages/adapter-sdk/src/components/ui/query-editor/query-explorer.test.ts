import { describe, expect, test } from "bun:test";
import {
  identifierInsertion,
  qualifiedSqlName,
  sqlOffset,
} from "./query-explorer";

describe("query explorer insertion", () => {
  test("uses qualified names and quotes identifiers that need it", () => {
    expect(qualifiedSqlName(["SHOP", "RAW", "RETAIL"])).toBe("SHOP.RAW.RETAIL");
    expect(qualifiedSqlName(["shop", "raw", "order items"])).toBe(
      'shop.raw."order items"',
    );
    expect(qualifiedSqlName(["shop", "raw", "retail"], true)).toBe(
      "raw.retail",
    );
    expect(qualifiedSqlName(["shop", "raw", "order"])).toBe('shop.raw."order"');
  });

  test("adds needed spacing at the editor selection", () => {
    expect(
      identifierInsertion("SELECT * FROM", 13, 13, "SHOP.RAW.RETAIL"),
    ).toBe(" SHOP.RAW.RETAIL");
    expect(
      identifierInsertion("SELECT * FROM ", 14, 14, "SHOP.RAW.RETAIL"),
    ).toBe("SHOP.RAW.RETAIL");
    expect(sqlOffset("SELECT *\nFROM ", 2, 6)).toBe(14);
  });
});
