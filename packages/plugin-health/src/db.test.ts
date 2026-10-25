import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import {
  applyMigrations,
  importLegacyHistory,
  migrations,
  openHealthDb,
} from "./db.js";
import { HOUR_MS } from "./rollups.js";
import { rangeStats } from "./slo.js";

function directoryStorage(
  directory: string,
): PluginStorage & { opened: string[] } {
  const handles = new Map<string, Database>();
  const opened: string[] = [];
  return {
    opened,
    directory: () => directory,
    openDatabase(name) {
      opened.push(name);
      let db = handles.get(name);
      if (!db) {
        db = new Database(join(directory, `${name}.sqlite`));
        handles.set(name, db);
      }
      return db;
    },
  };
}

test("migrations apply once and can run again", () => {
  const db = new Database(":memory:");
  applyMigrations(db);
  applyMigrations(db);
  expect(
    db
      .query<{ n: number }, []>("SELECT count(*) AS n FROM schema_migrations")
      .get()?.n,
  ).toBe(migrations.length);
  expect(
    db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE name = 'incidents'",
      )
      .get(),
  ).not.toBeNull();
});

test("history from the first version is imported once with rollups rebuilt", () => {
  const directory = mkdtempSync(join(tmpdir(), "dsui-health-"));
  try {
    const legacy = new Database(join(directory, "health-history.sqlite"));
    legacy.exec(`CREATE TABLE checks (
      service_id TEXT NOT NULL, time INTEGER NOT NULL, health TEXT NOT NULL,
      latency_ms REAL, PRIMARY KEY(service_id, time));`);
    const hour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS - 2 * HOUR_MS;
    const insert = legacy.query("INSERT INTO checks VALUES (?, ?, ?, ?)");
    insert.run("db", hour, "healthy", 20);
    insert.run("db", hour + 60_000, "healthy", 40);
    insert.run("db", hour + 120_000, "unavailable", null);
    legacy.close();

    const storage = directoryStorage(directory);
    const db = openHealthDb(storage);
    const stats = rangeStats(db, "db", 1, Date.now());
    expect(stats.measured).toBe(3);
    expect(stats.availability).toBeCloseTo((2 / 3) * 100, 5);

    expect(importLegacyHistory(storage, db)).toBe(0);
    expect(
      db.query<{ n: number }, []>("SELECT count(*) AS n FROM samples").get()?.n,
    ).toBe(3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a fresh install does not create the old history database", () => {
  const directory = mkdtempSync(join(tmpdir(), "dsui-health-"));
  try {
    const storage = directoryStorage(directory);
    openHealthDb(storage);
    expect(storage.opened).not.toContain("health-history");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
