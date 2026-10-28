import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { ingestActivity, pruneActivity } from "./activity.js";
import type { HealthConfig } from "./config.js";
import type { ServiceSummary } from "./context.js";
import { openHealthDb } from "./db.js";
import { recordProbeResult } from "./engine.js";
import { prune, readStates } from "./repo.js";
import { probeWithBudget, selectDue } from "./scheduler.js";
import { listServices } from "./view.js";

/** The slice of the plugin context the scheduler needs. */
export type TickContext = Pick<
  PluginContext<HealthConfig>,
  "config" | "services" | "storage" | "events" | "logger"
>;

const PRUNE_INTERVAL_MS = 60 * 60_000;
/** Prefix of this plugin's own signals, which describe incidents, not causes. */
const OWN_SIGNAL_PREFIX = "health.";

export type TickResult = { checked: number; due: number };

/**
 * Probes the services that are due, records the results and emits signals.
 *
 * The only code that probes. Pages, resources and slots read what this
 * recorded, so the number of open browser tabs has no effect on how hard
 * monitored systems are probed.
 *
 * `only` restricts the run to the given services and ignores their schedule,
 * which is how a manual check reuses the same recording path.
 */
export async function runTick(
  context: TickContext,
  options: {
    now?: () => number;
    only?: readonly ServiceSummary[];
    signal?: AbortSignal;
  } = {},
): Promise<TickResult> {
  const clock = options.now ?? Date.now;
  const db = openHealthDb(context.storage);
  const { config } = context;

  const services =
    options.only ?? (await listServices(context.services, config.maxServices));
  const due = options.only
    ? [...options.only]
    : selectDue(
        services,
        new Map(
          [...readStates(db)].map(([id, state]) => [id, state.nextDueAt]),
        ),
        clock(),
      );

  let checked = 0;
  await probeWithBudget(
    due,
    (id) => context.services.probe(id, { timeoutMs: config.timeoutMs }),
    {
      maxConcurrent: config.maxConcurrentProbes,
      maxPerAdapter: config.maxConcurrentProbesPerAdapter,
    },
    async ({ service, probe }) => {
      const outcome = recordProbeResult(db, config, service, probe, clock());
      checked++;
      if (!outcome.signal) return;
      try {
        await context.events.emit(
          outcome.signal.id,
          outcome.signal.payload,
          outcome.signal.serviceId,
          outcome.signal.type,
        );
      } catch (error) {
        context.logger.warn("Could not emit a health signal", {
          signal: outcome.signal.id,
          serviceId: outcome.signal.serviceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    options.signal,
  );

  if (!options.only) {
    await collectActivity(context, db);
    pruneIfDue(context, clock());
  }
  return { checked, due: due.length };
}

/** Keeps the activity log current. A failure here must never stop probing. */
async function collectActivity(
  context: TickContext,
  db: ReturnType<typeof openHealthDb>,
): Promise<void> {
  try {
    await ingestActivity(
      db,
      context.events.read?.bind(context.events),
      OWN_SIGNAL_PREFIX,
    );
  } catch (error) {
    context.logger.warn("Could not read signals for the activity log", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function pruneIfDue(context: TickContext, now: number): void {
  const db = openHealthDb(context.storage);
  const last = db
    .query<{ value: string }, []>(
      "SELECT value FROM meta WHERE key = 'last_pruned'",
    )
    .get();
  if (last && now - Number(last.value) < PRUNE_INTERVAL_MS) return;
  prune(db, now, {
    rawDays: context.config.rawRetentionDays,
    rollupDays: context.config.rollupRetentionDays,
  });
  pruneActivity(db, now);
  db.query(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_pruned', ?)",
  ).run(String(now));
}
