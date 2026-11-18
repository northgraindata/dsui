import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DsuiDatabase } from "../src/db/database";
import { runMigrations } from "../src/db/migrate";
import { migrations } from "../src/db/migrations";

for (const previewTable of [false, true]) {
  test(`settings upgrade preserves existing data when migration 13 is occupied${previewTable ? " and a preview table exists" : ""}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-migration-settings-"));
    const path = join(root, "dsui.sqlite");
    const old = new Database(path);
    runMigrations(
      old,
      migrations.filter((migration) => migration.version <= 12),
    );
    old
      .query(
        "INSERT INTO schema_migrations(version, applied_at) VALUES (13, ?)",
      )
      .run("2026-10-06T18:42:41.171Z");
    old
      .query(
        "INSERT INTO ui_services(id, name, adapter, connection_ciphertext, connection_iv, connection_tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "warehouse",
        "Existing warehouse",
        "postgresql",
        "encrypted",
        "iv",
        "tag",
        "before",
        "before",
      );
    if (previewTable) {
      old.exec(
        "CREATE TABLE settings(scope TEXT NOT NULL, owner TEXT NOT NULL, value TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(scope, owner));",
      );
      old
        .query("INSERT INTO settings VALUES ('installation', '', ?, 1)")
        .run('{"name":"Preview workspace"}');
    }
    old.close();
    let current: DsuiDatabase | undefined;
    try {
      current = new DsuiDatabase(path);
      expect(current.listUiServices()).toHaveLength(1);
      expect(current.listUiServices()[0].connection_ciphertext).toBe(
        "encrypted",
      );
      expect(
        current.sqlite
          .query("SELECT applied_at FROM schema_migrations WHERE version = 13")
          .get(),
      ).toEqual({ applied_at: "2026-10-06T18:42:41.171Z" });
      expect(
        current.sqlite
          .query("SELECT version FROM schema_migrations WHERE version = 14")
          .get(),
      ).toEqual({ version: 14 });
      expect(
        current.sqlite
          .query("SELECT name FROM sqlite_master WHERE name = 'settings'")
          .get(),
      ).toEqual({ name: "settings" });
      if (previewTable)
        expect(
          current.sqlite.query("SELECT value FROM settings").get(),
        ).toEqual({ value: '{"name":"Preview workspace"}' });
      current.close();
      current = new DsuiDatabase(path);
      expect(current.listUiServices()).toHaveLength(1);
      expect(
        current.sqlite
          .query(
            "SELECT count(*) AS count FROM schema_migrations WHERE version = 14",
          )
          .get(),
      ).toEqual({ count: 1 });
    } finally {
      current?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}
