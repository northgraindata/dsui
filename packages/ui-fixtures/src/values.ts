/**
 * Plausible primitive values chosen from a property name. Output depends only
 * on the name and row index, so screenshots stay stable between runs.
 */
const LONG_SUFFIX =
  "_with_an_unusually_long_identifier_that_never_offers_a_natural_wrapping_point";
const LONG_SENTENCE =
  " This description keeps going so that cards, tables and headers have to prove they can wrap or truncate long values without pushing the layout wider than its container.";
const NOUNS = ["orders", "customers", "payments", "events", "sessions"];

const STRING_RULES: readonly [RegExp, (row: number) => string][] = [
  [
    /(sql|query|statement|definition|ddl)$/i,
    () => "SELECT * FROM orders LIMIT 100",
  ],
  [
    /(at|time|date|since|timestamp|start|end)$/i,
    (row) => `2026-01-${String((row % 27) + 1).padStart(2, "0")}T10:15:00Z`,
  ],
  [
    /(description|message|detail|comment|reason|error)$/i,
    () => "Rebuilds the daily revenue model.",
  ],
  [/(url|uri|endpoint|href)$/i, () => "https://example.test/resource"],
  [
    /(path|location|file)$/i,
    (row) => `/warehouse/models/${NOUNS[row % NOUNS.length]}.sql`,
  ],
  [/(size|bytes)$/i, (row) => `${(row + 1) * 12} MB`],
  [/(duration|elapsed|runtime)$/i, (row) => `${(row + 1) * 7}s`],
  [/(owner|user|author|username)$/i, () => "analytics"],
  [/(type|kind)$/i, () => "table"],
  [
    /(state|status)$/i,
    (row) => ["success", "running", "failed"][row % 3] ?? "success",
  ],
  [/(database|catalog)$/i, () => "analytics"],
  [/schema$/i, () => "public"],
  [/version$/i, () => "16.4"],
  [/icon$/i, () => "database"],
  [/(tone|severity|variant)$/i, () => "healthy"],
];

export function sampleString(
  name: string,
  row: number,
  longText: boolean,
): string {
  const rule = STRING_RULES.find(([pattern]) => pattern.test(name));
  const base = rule ? rule[1](row) : `${NOUNS[row % NOUNS.length]}_${row + 1}`;
  if (
    !longText ||
    /(at|time|date|since|icon|tone|severity|variant)$/i.test(name)
  )
    return base;
  return base.includes(" ") ? base + LONG_SENTENCE : base + LONG_SUFFIX;
}

export function sampleNumber(
  name: string,
  row: number,
  longText: boolean,
): number {
  if (/(percent|pct|ratio|progress)/i.test(name)) return (row * 17 + 23) % 100;
  if (/(bytes|size)/i.test(name))
    return longText ? 987_654_321_987 : (row + 1) * 1_048_576;
  if (/(max|limit|capacity|total)/i.test(name)) return 1000;
  return longText ? 123_456_789 + row : (row + 1) * 7;
}
