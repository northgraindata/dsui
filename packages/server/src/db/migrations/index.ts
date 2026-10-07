import type { Migration } from "../migrate.js";
import { migration_0001_init } from "./0001_init.js";
import { migration_0002_local_sessions } from "./0002_local_sessions.js";
import { migration_0003_enterprise_auth } from "./0003_enterprise_auth.js";
import { migration_0004_mock_settings } from "./0004_mock_settings.js";
import { migration_0005_drop_mock_settings } from "./0005_drop_mock_settings.js";
import { migration_0006_store_state } from "./0006_store_state.js";
import { migration_0007_remove_legacy_enterprise } from "./0007_remove_legacy_enterprise.js";
import { migration_0008_plugin_jobs } from "./0008_plugin_jobs.js";
import { migration_0009_plugin_job_intervals } from "./0009_plugin_job_intervals.js";
import { migration_0010_events } from "./0010_events.js";
import { migration_0011_event_type } from "./0011_event_type.js";

import { migration_0012_event_sequence } from "./0012_event_sequence.js";

import { migration_0013_event_origin } from "./0013_event_origin.js";

/** All migrations in version order. Add new files here, never reorder. */
export const migrations: Migration[] = [
  migration_0001_init,
  migration_0002_local_sessions,
  migration_0003_enterprise_auth,
  migration_0004_mock_settings,
  migration_0005_drop_mock_settings,
  migration_0006_store_state,
  migration_0007_remove_legacy_enterprise,
  migration_0008_plugin_jobs,
  migration_0009_plugin_job_intervals,
  migration_0010_events,
  migration_0011_event_type,
  migration_0012_event_sequence,
  migration_0013_event_origin,
];
