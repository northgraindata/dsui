import { expect, test } from "bun:test";
import {
  grantSql,
  procedureArguments,
  qualifiedName,
} from "../src/sql-values.js";

test("qualified names preserve case, dots and quotes within each identifier", () => {
  expect(qualifiedName("Db.With.Dot", 'A"B', "Items")).toBe(
    '"Db.With.Dot"."A""B"."Items"',
  );
});

test("grant objects support qualified SQL identifiers without executable fragments", () => {
  expect(
    grantSql(
      "GRANT",
      {
        privilege: "select",
        objectType: "table",
        objectName: 'db."Mixed.Case".items',
      },
      "Analyst",
    ),
  ).toBe('GRANT SELECT ON TABLE "DB"."Mixed.Case"."ITEMS" TO ROLE "Analyst"');
  for (const objectName of [
    "DB.T; DROP USER X",
    "DB..T",
    "T -- comment",
    '"unclosed',
    "DB.PUBLIC.T.EXTRA",
  ]) {
    expect(() =>
      grantSql(
        "GRANT",
        { privilege: "SELECT", objectType: "TABLE", objectName },
        "R",
      ),
    ).toThrow();
  }
  expect(() =>
    grantSql(
      "GRANT",
      { privilege: "OWNERSHIP", objectType: "TABLE", objectName: "T" },
      "R",
    ),
  ).toThrow();
});

test("procedure arguments are scalar data, never executable SQL", () => {
  expect(procedureArguments("")).toEqual([]);
  expect(procedureArguments('["O\'Hare", 42, true, null]')).toEqual([
    "O'Hare",
    42,
    true,
    null,
  ]);
  for (const input of [
    "CURRENT_USER()",
    "1); DROP USER X; --",
    '[{"nested":true}]',
    "[1e400]",
  ]) {
    expect(() => procedureArguments(input)).toThrow();
  }
});
