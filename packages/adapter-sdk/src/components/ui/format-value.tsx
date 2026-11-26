import type { ReactNode } from "react";
import { type DisplayPreferences, formatDisplayDate } from "./preferences";

type DatePreferences = Pick<DisplayPreferences, "timeZone" | "clock">;

const ACRONYMS = new Map(
  ["api", "dag", "ddl", "id", "ip", "sql", "uri", "url", "uuid"].map((word) => [
    word,
    word.toUpperCase(),
  ]),
);
ACRONYMS.set("ids", "IDs");
ACRONYMS.set("dags", "DAGs");

/** Matches identifiers such as `isPaused` or `total_rows`, not written text. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*(_[a-zA-Z0-9]+)*$/;

/** Turns a field name into a label. Keys that are data are left as they are. */
export function humanizeKey(key: string): string {
  if (!IDENTIFIER.test(key)) return key;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[ _]/)
    .map((word) => word.toLowerCase())
    .map((word, index) => {
      const acronym = ACRONYMS.get(word);
      if (acronym) return acronym;
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    });
  return words.join(" ");
}

/** A date and time with a zone. Without one, shifting it would be a guess. */
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && TIMESTAMP.test(value);
}

/** Plain text for one value; nested objects read as `name: value` pairs. */
export function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length ? value.map(valueText).join(", ") : "—";
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length
      ? entries.map(([key, item]) => `${key}: ${valueText(item)}`).join(", ")
      : "—";
  }
  return String(value);
}

/** A timestamp in the user's settings, with the exact value on hover. */
export function formatTimestamp(
  value: unknown,
  preferences: DatePreferences,
): ReactNode {
  if (!isTimestamp(value)) return valueText(value);
  return (
    <time dateTime={value} title={value}>
      {formatDisplayDate(value, preferences)}
    </time>
  );
}
