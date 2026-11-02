import { describe, expect, test } from "bun:test";
import { assertReadOnlySql } from "../src/sql-guard.js";

describe("assertReadOnlySql", () => {
  test("allows read statements and trims a trailing semicolon", () => {
    expect(assertReadOnlySql(" SELECT 1; ")).toBe("SELECT 1");
    expect(assertReadOnlySql("with a as (select 1) select * from a")).toContain(
      "with",
    );
    expect(assertReadOnlySql("DESCRIBE orders")).toBe("DESCRIBE orders");
  });

  test("ignores keywords inside strings, quoted names and comments", () => {
    expect(() =>
      assertReadOnlySql("SELECT 'drop table x' AS note"),
    ).not.toThrow();
    expect(() =>
      assertReadOnlySql('SELECT "update" FROM t -- delete me'),
    ).not.toThrow();
  });

  test("refuses writes, side effects and multiple statements", () => {
    for (const sql of [
      "INSERT INTO t VALUES (1)",
      "DROP TABLE t",
      "COPY t TO 'x.csv'",
      "ATTACH 'x.db'",
      "SELECT 1; DELETE FROM t",
      "SELECT * FROM t; SELECT 2",
      "PRAGMA database_list",
      "",
    ]) {
      expect(() => assertReadOnlySql(sql)).toThrow();
    }
  });

  test("refuses a write hidden behind a read keyword", () => {
    expect(() =>
      assertReadOnlySql("WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x"),
    ).toThrow("INSERT");
  });
});
