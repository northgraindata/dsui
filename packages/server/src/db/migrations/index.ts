import type { Migration } from "../migrate.js";
import { migration_0001_init } from "./0001_init.js";
import { migration_0002_local_sessions } from "./0002_local_sessions.js";
import { migration_0003_enterprise_auth } from "./0003_enterprise_auth.js";
import { migration_0004_mock_settings } from "./0004_mock_settings.js";
import { migration_0005_drop_mock_settings } from "./0005_drop_mock_settings.js";

/** All migrations in version order. Add new files here, never reorder. */
export const migrations: Migration[] = [
  migration_0001_init,
  migration_0002_local_sessions,
  migration_0003_enterprise_auth,
  migration_0004_mock_settings,
  migration_0005_drop_mock_settings,
];
