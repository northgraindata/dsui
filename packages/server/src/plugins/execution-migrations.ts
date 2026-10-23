import type { Migration } from "../db/migrate.js";

// Adopt databases created before execution storage used versioned migrations.
export const executionMigrations: readonly Migration[] = [
  {
    version: 1,
    name: "execution-authority",
    up: (database) =>
      database.exec(`
      CREATE TABLE IF NOT EXISTS grants (
        plugin_id TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY(plugin_id,id)
      );
      CREATE TABLE IF NOT EXISTS continuations (
        id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS continuations_authority ON continuations(plugin_id,json_extract(data,'$.authorityKey'),expires_at);`),
  },
];
