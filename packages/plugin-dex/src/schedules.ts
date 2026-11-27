import { randomUUID } from "node:crypto";
import {
  type PluginCapabilities,
  PluginRequestError,
  type PluginStorage,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  type OutputCommand,
  outputCommandSchema,
  runCommandsSchema,
  type Schedule,
  type ScheduleRule,
  type ScheduleRuleInput,
  scheduleRuleInputSchema,
} from "./contract.js";
import { database } from "./database.js";

const MINUTE = 60_000;
const rowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  rule: z.string(),
  enabled: z.number(),
  next_run_at: z.string().nullable(),
  time_zone: z.string().nullable(),
  commands: z.string().nullable(),
});

function parseRow(value: unknown) {
  const row = rowSchema.parse(value);
  return {
    id: row.id,
    projectId: row.project_id,
    rule: scheduleRuleInputSchema.parse(JSON.parse(row.rule)),
    enabled: row.enabled === 1,
    nextRunAt: row.next_run_at,
    timeZone: row.time_zone,
    ...(row.commands && {
      commands: runCommandsSchema.parse(JSON.parse(row.commands)),
    }),
  };
}

export function scheduleTimeZone(
  context: Pick<PluginCapabilities, "installationTimeZone">,
) {
  return (
    context.installationTimeZone?.() ??
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

export function nextOccurrence(
  rule: ScheduleRuleInput,
  timeZone: string,
  now: number,
): string {
  if (rule.kind === "interval")
    return new Date(now + rule.intervalMinutes * MINUTE).toISOString();

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  // Include the previous day so a repeated local hour can only match once.
  const minute = Math.floor(now / MINUTE) * MINUTE;
  const matchedDays = new Set<string>();
  for (
    let candidate = minute - 26 * 60 * MINUTE;
    candidate <= minute + 72 * 60 * MINUTE;
    candidate += MINUTE
  ) {
    const local = formatter.format(candidate);
    if (!local.endsWith(` ${rule.time}`)) continue;
    const day = local.slice(0, -6);
    if (matchedDays.has(day)) continue;
    if (candidate > now) return new Date(candidate).toISOString();
    matchedDays.add(day);
  }
  throw new Error("Unable to compute the next Dex schedule occurrence");
}

export function listSchedules(
  storage: PluginStorage,
  projectId: string,
): ScheduleRule[] {
  return database(storage)
    .query(
      "SELECT * FROM schedule_rules WHERE project_id = ? ORDER BY next_run_at IS NULL, next_run_at, id",
    )
    .all(projectId)
    .map((value) => {
      const { projectId: _, timeZone: _zone, ...rule } = parseRow(value);
      return rule;
    });
}

export function nextScheduledRun(
  storage: PluginStorage,
  projectId: string,
): string | null {
  return (
    listSchedules(storage, projectId).find((rule) => rule.enabled)?.nextRunAt ??
    null
  );
}

export function saveRule(
  storage: PluginStorage,
  projectId: string,
  input: {
    id?: string;
    rule: ScheduleRuleInput;
    enabled: boolean;
    commands?: OutputCommand[];
  },
  timeZone: string,
  now = Date.now(),
): ScheduleRule {
  const id = input.id ?? randomUUID();
  const nextRunAt = input.enabled
    ? nextOccurrence(input.rule, timeZone, now)
    : null;
  const args = [
    JSON.stringify(input.rule),
    Number(input.enabled),
    nextRunAt,
    input.rule.kind === "daily" ? timeZone : null,
    input.commands ? JSON.stringify(input.commands) : null,
  ] as const;
  const db = database(storage);
  const saved = input.id
    ? db
        .query(`UPDATE schedule_rules SET rule = ?, enabled = ?, next_run_at = ?,
        time_zone = ?, commands = COALESCE(?, commands)
        WHERE id = ? AND project_id = ? RETURNING *`)
        .get(...args, id, projectId)
    : db
        .query(`INSERT INTO schedule_rules (rule, enabled, next_run_at, time_zone, commands, id, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`)
        .get(...args, id, projectId);
  if (!saved) throw new PluginRequestError("Dex schedule not found", 404);
  const { commands } = parseRow(saved);
  return {
    id,
    rule: input.rule,
    enabled: input.enabled,
    nextRunAt,
    ...(commands && { commands }),
  };
}

export function removeRule(
  storage: PluginStorage,
  projectId: string,
  id: string,
): void {
  const deleted = database(storage)
    .query("DELETE FROM schedule_rules WHERE id = ? AND project_id = ?")
    .run(id, projectId).changes;
  if (!deleted) throw new PluginRequestError("Dex schedule not found", 404);
}

export function readSchedule(
  storage: PluginStorage,
  projectId: string,
): Schedule {
  const legacy = listSchedules(storage, projectId).find(
    (rule) => rule.id === `legacy:${projectId}`,
  );
  return legacy?.enabled && legacy.rule.kind === "interval"
    ? {
        intervalMinutes: legacy.rule.intervalMinutes,
        nextRunAt: legacy.nextRunAt,
      }
    : { intervalMinutes: 0, nextRunAt: null };
}

export function saveSchedule(
  storage: PluginStorage,
  projectId: string,
  intervalMinutes: number,
): Schedule {
  const db = database(storage);
  const id = `legacy:${projectId}`;
  if (intervalMinutes === 0) {
    db.query("DELETE FROM schedule_rules WHERE id = ?").run(id);
    return { intervalMinutes, nextRunAt: null };
  }
  const rule = { kind: "interval", intervalMinutes } as const;
  const nextRunAt = nextOccurrence(rule, "UTC", Date.now());
  db.query(`INSERT INTO schedule_rules (id, project_id, rule, enabled, next_run_at)
    VALUES (?, ?, ?, 1, ?) ON CONFLICT (id) DO UPDATE SET
    rule = excluded.rule, enabled = 1, next_run_at = excluded.next_run_at, time_zone = NULL, commands = NULL`).run(
    id,
    projectId,
    JSON.stringify(rule),
    nextRunAt,
  );
  return { intervalMinutes, nextRunAt };
}

export function claimSchedules(
  storage: PluginStorage,
  projects: ReadonlySet<string>,
  timeZone: string,
  now = Date.now(),
) {
  const db = database(storage);
  return db
    .transaction(() => {
      const stamp = new Date(now).toISOString();
      const claimed = new Map<
        string,
        {
          scheduleId: string;
          scheduledFor: string;
          commands: Set<OutputCommand>;
        }
      >();
      const candidates = db
        .query(`SELECT * FROM schedule_rules
      WHERE enabled = 1 AND (next_run_at <= ? OR (time_zone IS NOT NULL AND time_zone != ?))
      ORDER BY next_run_at, id`)
        .all(stamp, timeZone);
      for (const value of candidates) {
        const row = parseRow(value);
        if (!projects.has(row.projectId)) continue;
        const sameZone =
          row.rule.kind === "interval" || row.timeZone === timeZone;
        db.query(
          "UPDATE schedule_rules SET next_run_at = ?, time_zone = ? WHERE id = ?",
        ).run(
          nextOccurrence(row.rule, timeZone, now),
          row.rule.kind === "daily" ? timeZone : null,
          row.id,
        );
        if (!sameZone || !row.nextRunAt) continue;
        let occurrence = claimed.get(row.projectId);
        if (!occurrence) {
          occurrence = {
            scheduleId: row.id,
            scheduledFor: row.nextRunAt,
            commands: new Set(),
          };
          claimed.set(row.projectId, occurrence);
        }
        for (const command of row.commands ?? outputCommandSchema.options)
          occurrence.commands.add(command);
      }
      return claimed;
    })
    .immediate();
}
