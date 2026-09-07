import { describe, expect, it } from "bun:test";
import { DsuiDatabase } from "../src/db/database";

describe("database migrations", () => {
  it("applies versions 1-5 on a fresh database", () => {
    const database = new DsuiDatabase(":memory:");
    try {
      const versions = database.sqlite
        .query<{ version: number }, []>(
          "SELECT version FROM schema_migrations ORDER BY version",
        )
        .all()
        .map((row) => row.version);
      expect(versions).toEqual([1, 2, 3, 4, 5]);
      const columns = database.sqlite
        .query<{ name: string }, []>(
          "SELECT name FROM pragma_table_info('ui_services')",
        )
        .all()
        .map((row) => row.name);
      expect(columns).not.toContain("mock_settings");
      expect(columns).toContain("connection_ciphertext");
    } finally {
      database.close();
    }
  });

  it("reopening is a no-op", () => {
    const first = new DsuiDatabase(":memory:");
    first.close();
    const second = new DsuiDatabase(":memory:");
    try {
      const count = second.sqlite
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM schema_migrations",
        )
        .get();
      expect(count?.count).toBe(5);
    } finally {
      second.close();
    }
  });

  it("persists services and audit events", () => {
    const database = new DsuiDatabase(":memory:");
    try {
      database.insertUiService(
        { id: "svc", name: "Snow", adapter: "snowflake" },
        { ciphertext: "c", iv: "i", tag: "t" },
      );
      expect(database.listUiServices()).toHaveLength(1);
      expect(database.getUiService("missing")).toBeNull();
      database.audit("u", "service.create", "svc", { adapter: "snowflake" });
      database.deleteUiService("svc");
      expect(database.listUiServices()).toHaveLength(0);
    } finally {
      database.close();
    }
  });
});
