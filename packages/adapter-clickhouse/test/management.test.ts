import { expect, test } from "bun:test";
import {
  alterTableInput,
  alterTableSql,
  createTableInput,
  createTableSql,
} from "../src/management";
import { validateSql } from "../src/sql";

test("engine-aware table creation includes explicit keys, TTL and cluster", () => {
  const input = createTableInput.parse({
    database: "analytics",
    name: "events",
    confirmTarget: "analytics.events",
    columns: "id UInt64, ts DateTime",
    engine: "MergeTree",
    orderBy: "id",
    partitionBy: "toYYYYMM(ts)",
    ttl: "ts + INTERVAL 30 DAY",
    cluster: "warehouse",
  });
  const sql = createTableSql(input);
  expect(sql).toContain("ON CLUSTER `warehouse`");
  expect(sql).toContain(
    "PARTITION BY toYYYYMM(ts) ORDER BY id TTL ts + INTERVAL 30 DAY",
  );
  expect(validateSql(sql)).toBe("CREATE");
  expect(() => createTableSql({ ...input, engine: "Memory" })).toThrow(
    "MergeTree",
  );
  expect(() =>
    createTableSql({ ...input, columns: "id UInt8); DROP TABLE x; --" }),
  ).toThrow("one SQL statement");
});
test("partition and mutation actions quote identifiers and literal values", () => {
  const input = alterTableInput.parse({
    database: "db",
    name: "events",
    confirmTarget: "db.events",
    operation: "detach-partition",
    partitionId: "2026'10",
  });
  expect(alterTableSql(input)).toBe(
    "ALTER TABLE `db`.`events` DETACH PARTITION ID '2026\\'10'",
  );
  expect(
    alterTableSql({
      ...input,
      operation: "kill-mutation",
      definition: "mutation_1.txt",
    }),
  ).toContain("mutation_id = 'mutation_1.txt'");
  expect(() => alterTableSql({ ...input, partitionId: "" })).toThrow(
    "partition ID",
  );
  expect(
    alterTableSql({ ...input, operation: "rename", definition: "a`b" }),
  ).toContain("TO `db`.`a\\`b`");
});
