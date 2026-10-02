/**
 * A small cron parser: five fields, minute resolution, no seconds.
 *
 * `minute hour day-of-month month day-of-week`, each a comma-separated list of
 * values, `*`, ranges `a-b`, and `*\/n` steps. Month and weekday accept names
 * (`jan`, `mon`). Standard cron quirks are honoured deliberately rather than by
 * accident: day-of-month and day-of-week both restricted means either may
 * match, which is what every other cron implementation does and what anyone
 * writing a schedule expects.
 *
 * Everything is computed in UTC. A schedule that shifts with the host's zone
 * means the same job runs at a different wall-clock time when DSUI moves
 * between machines, and a run that repeats at an unexpected hour is worse than
 * one that is consistently an hour off.
 */

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MONTH_NAMES = new Map(MONTHS.map((name, index) => [name, index + 1]));
const WEEKDAY_NAMES = new Map(
  WEEKDAYS.map((name, index) => [name, index]),
);

export interface CronSchedule {
  /**
   * Next time the schedule is due strictly after `after`, in milliseconds.
   *
   * Returns null when no time matches within five years, which happens for a
   * date that can never occur such as 30 February. A scheduler that silently
   * treats that as "due every minute" would run a job nobody can schedule.
   */
  nextAfter(after: Date): number | null;
  /** Whether the expression parsed. Invalid input is rejected at load. */
  readonly valid: boolean;
  readonly expression: string;
}

class CronError extends Error {}

function parseField(
  field: string,
  min: number,
  max: number,
  names?: Map<string, number>,
): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, step] = part.split("/");
    const stepSize = step === undefined ? 1 : Number(step);
    if (!Number.isInteger(stepSize) || stepSize < 1)
      throw new CronError(`Invalid step "${step}"`);

    let low: number;
    let high: number;
    if (range === undefined || range === "*") {
      low = min;
      high = max;
    } else if (range.startsWith("-")) {
      throw new CronError(`Invalid range "${range}"`);
    } else {
      const [from, to] = range.split("-");
      const parse = (value: string): number => {
        const lowered = value.toLowerCase();
        if (names?.has(lowered)) return names.get(lowered)!;
        const numeric = Number(value);
        if (!Number.isInteger(numeric)) throw new CronError(`Invalid "${value}"`);
        return numeric;
      };
      low = parse(from);
      high = to === undefined ? (range.includes("-") ? parse(to) : low) : parse(to);
      if (high < low) throw new CronError(`Range "${range}" is inverted`);
    }
    if (low < min || high > max)
      throw new CronError(`Value out of range ${min}-${max} in "${field}"`);
    for (let value = low; value <= high; value += stepSize) values.add(value);
  }
  if (!values.size) throw new CronError(`Field "${field}" matches nothing`);
  return values;
}

/**
 * Parses an expression, or returns a schedule that never fires.
 *
 * An invalid expression does not throw here: the caller is the plugin loader,
 * which turns a bad schedule into a startup error with the expression in the
 * message. Throwing at parse time inside a scheduler loop would instead take
 * down every other job.
 */
export function parseCron(expression: string): CronSchedule {
  let fields: Set<number>[];
  let minute: Set<number>;
  let hour: Set<number>;
  let dayOfMonth: Set<number>;
  let month: Set<number>;
  let dayOfWeek: Set<number>;
  let dayOfMonthRestricted = false;
  let dayOfWeekRestricted = false;
  try {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5)
      throw new CronError(
        `Expected 5 fields, found ${parts.length} in "${expression}"`,
      );
    minute = parseField(parts[0], 0, 59);
    hour = parseField(parts[1], 0, 23);
    dayOfMonthRestricted = parts[2].trim() !== "*";
    dayOfMonth = parseField(parts[2], 1, 31);
    month = parseField(parts[3], 1, 12, MONTH_NAMES);
    dayOfWeekRestricted = parts[4].trim() !== "*";
    // 7 is Sunday in some implementations and an error in others; accept it.
    const weekdayRaw = parseField(
      parts[4].replace(/\b7\b/g, "0"),
      0,
      6,
      WEEKDAY_NAMES,
    );
    dayOfWeek = weekdayRaw;
    fields = [minute, hour, dayOfMonth, month, dayOfWeek];
  } catch (error) {
    if (!(error instanceof CronError)) throw error;
    return {
      valid: false,
      expression,
      nextAfter: () => null,
    };
  }

  const matches = (date: Date): boolean => {
    if (!minute.has(date.getUTCMinutes())) return false;
    if (!hour.has(date.getUTCHours())) return false;
    if (!month.has(date.getUTCMonth() + 1)) return false;
    const dayMatch = dayOfMonth.has(date.getUTCDate());
    const weekMatch = dayOfWeek.has(date.getUTCDay());
    // Both restricted means either may match, matching every other cron.
    return dayOfMonthRestricted && dayOfWeekRestricted
      ? dayMatch || weekMatch
      : dayOfMonthRestricted
        ? dayMatch
        : dayOfWeekRestricted
          ? weekMatch
          : true;
  };

  return {
    valid: fields.every((field) => field.size > 0),
    expression,
    nextAfter(after: Date): number | null {
      // Start at the next whole minute: a job is due on minute boundaries, and
      // advancing from the exact `after` would re-fire the minute just passed.
      const cursor = new Date(
        Date.UTC(
          after.getUTCFullYear(),
          after.getUTCMonth(),
          after.getUTCDate(),
          after.getUTCHours(),
          after.getUTCMinutes(),
        ) + 60_000,
      );
      const limit = new Date(after.getTime() + 5 * 366 * 24 * 3_600_000);
      while (cursor.getTime() <= limit.getTime()) {
        if (matches(cursor)) return cursor.getTime();
        cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
      }
      return null;
    },
  };
}

/** Throws with a readable message when an expression cannot be used. */
export function assertCron(expression: string): CronSchedule {
  const schedule = parseCron(expression);
  if (!schedule.valid)
    throw new CronError(`Invalid cron expression: "${expression}"`);
  return schedule;
}