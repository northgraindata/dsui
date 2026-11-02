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

  test("refuses file, URL and settings access", () => {
    for (const sql of [
      "SELECT * FROM read_text('/etc/passwd')",
      "SELECT * FROM read_csv('/tmp/a')",
      "SELECT * FROM READ_PARQUET('a')",
      "SELECT * FROM glob('/*')",
      "SELECT * FROM parquet_scan('a')",
      "SELECT * FROM parquet_metadata('a')",
      "SELECT * FROM sniff_csv('a')",
      "SELECT * FROM iceberg_scan('a')",
      "SELECT * FROM query_table('t')",
      "SELECT * FROM query('select 1')",
      "SELECT getenv('HOME')",
      "SELECT current_setting('s3_secret_access_key')",
      "SELECT * FROM \"read_csv\"('a')",
      "SELECT * FROM '/etc/x.csv'",
      "SELECT * FROM 'data'",
      "SELECT * FROM ('a.parquet')",
      "SELECT * FROM t JOIN 'a.parquet' ON true",
      "SELECT * FROM t, 'a.csv'",
      'SELECT * FROM "/etc/x.csv"',
      'SELECT * FROM "a.parquet"',
      "SELECT '--' FROM '/etc/x'",
      "SELECT * FROM t WHERE u = 'https://example.com/x'",
    ]) {
      expect(() => assertReadOnlySql(sql)).toThrow();
    }
  });

  test("allows look-alikes of the blocked forms", () => {
    for (const sql of [
      "SELECT 'from' AS word",
      "SELECT 'read_csv(x)' AS note",
      'SELECT * FROM "orders" JOIN customers USING (id)',
      "SELECT * FROM t WHERE name IN ('a', 'b')",
      "SELECT a, 'x' FROM t",
      "SELECT 'it''s' FROM t",
      "SELECT 1 /* from 'x' */",
      "SELECT scan_count, glob_pattern FROM t",
      "WITH r AS (SELECT 1) SELECT * FROM r",
    ]) {
      expect(() => assertReadOnlySql(sql)).not.toThrow();
    }
  });
});
