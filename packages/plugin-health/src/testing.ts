import { Database } from "bun:sqlite";
import { configSchema, type HealthConfig } from "./config.js";
import type { Probe, ServiceSummary } from "./context.js";
import { applyMigrations } from "./db.js";

/** An in-memory database with the plugin schema applied. */
export function testDb(): Database {
  return applyMigrations(new Database(":memory:"));
}

export function testConfig(
  overrides: Record<string, unknown> = {},
): HealthConfig {
  return configSchema.parse({
    failureThreshold: 2,
    recoveryThreshold: 2,
    ...overrides,
  });
}

export function service(
  id: string,
  adapter = "test",
  name = id,
): ServiceSummary {
  return { id, name, adapter, managedBy: "ui" };
}

export function probe(
  id: string,
  health: Probe["health"],
  extra: Partial<Probe> = {},
): Probe {
  return { id, health, ...extra };
}
