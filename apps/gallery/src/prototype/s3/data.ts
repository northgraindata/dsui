/*
 * Invented data for the S3 prototype. Fields are those ListBuckets,
 * ListObjectsV2, HeadObject and friends return.
 */
export const NOW = new Date(2026, 10, 27, 11, 0);
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const two = (value: number) => String(value).padStart(2, "0");
export function stamp(date: Date) {
  const days = Math.round(
    (new Date(NOW).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Yesterday"
        : date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            ...(date.getFullYear() === NOW.getFullYear()
              ? {}
              : { year: "numeric" }),
          });
  return `${day} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
export const exact = (date: Date) =>
  `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;

export function bytes(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  const step =
    size > 0 ? Math.min(units.length - 1, Math.floor(Math.log2(size) / 10)) : 0;
  const value = size / 1024 ** step;
  return `${value.toFixed(step && value < 100 ? 1 : 0)} ${units[step]}`;
}

export interface Bucket {
  name: string;
  region: string;
  created: Date;
}

const bucket = (name: string, region: string, days: number): Bucket => ({
  name,
  region,
  created: ago(days * 1440 + days * 7),
});

export const buckets: Bucket[] = [
  bucket("acme-lake", "eu-central-1", 810),
  bucket("acme-lake-staging", "eu-central-1", 702),
  bucket("acme-exports", "eu-central-1", 640),
  bucket("acme-ml-artifacts", "eu-west-1", 411),
  bucket("acme-airflow-logs", "eu-central-1", 590),
  bucket("acme-athena-results", "eu-central-1", 520),
  bucket("acme-backups-postgres", "eu-north-1", 905),
  bucket("acme-cdn-assets", "us-east-1", 1200),
  bucket("acme-partner-inbound", "eu-west-1", 260),
  bucket("acme-terraform-state", "eu-central-1", 1010),
  ...Array.from({ length: 37 }, (_, index) =>
    bucket(
      `acme-team-${["analytics", "growth", "finance", "support", "platform"][index % 5]}-sandbox-${index + 1}`,
      ["eu-central-1", "eu-west-1", "us-east-1"][index % 3] as string,
      20 + index * 9,
    ),
  ),
];

export interface Entry {
  /** The full key; a folder ends with a slash, as in a common prefix. */
  key: string;
  size?: number;
  modified?: Date;
  storageClass?: string;
}

export const nameOf = (key: string) => {
  const parts = key.split("/");
  return key.endsWith("/") ? `${parts.at(-2)}/` : (parts.at(-1) ?? key);
};
export const parentOf = (key: string) => key.replace(/[^/]+\/?$/, "");

const file = (
  name: string,
  size: number,
  minutes: number,
  storageClass = "STANDARD",
): Entry => ({ key: name, size, modified: ago(minutes), storageClass });
const dir = (name: string): Entry => ({ key: name });

const samples: [string, number, number, string?][] = [
  ["customers.csv", 4_812_004, 95],
  ["orders_2026-11-26.snappy.parquet", 187_432_119, 320],
  ["events.jsonl.gz", 52_118_400, 14],
  ["dbt_manifest.json", 1_920_330, 600],
  ["load_orders.py", 3_204, 2_900],
  ["revenue_by_day.sql", 1_422, 4_300],
  ["pipeline.yaml", 912, 8_700],
  ["deploy.sh", 640, 20_000],
  ["README.md", 2_310, 1_500],
  ["airflow-task.log", 88_204, 61],
  ["notes.txt", 311, 44_000],
  ["churn_model.ipynb", 412_992, 7_200],
  ["revenue-chart.png", 214_880, 340],
  ["q3-report.pdf", 2_411_020, 12_000],
  ["demo-walkthrough.mp4", 48_220_114, 30_000],
  ["standup-recording.mp3", 6_104_002, 31_000],
  ["partner-drop-2026-11.zip", 91_004_221, 2_100],
  ["model.weights", 734_003_200, 9_000],
  ["_SUCCESS", 0, 320],
  ["2024-audit-archive.csv", 912_004_221, 400_000, "GLACIER"],
  [
    "a_very_long_file_name_from_a_partner_who_encodes_everything_into_it__region=eu__customer=enterprise__generated=2026-11-26T05-00-00Z__v3-final-FINAL.csv",
    18_204,
    700,
  ],
];

/** Folders and files of each prefix that was written by hand. */
const tree: Record<string, Entry[]> = {
  "acme-lake/": [
    dir("curated/"),
    dir("raw/"),
    dir("samples/"),
    dir("staging/"),
    dir("tmp/"),
    file("README.md", 2_310, 1_500),
    file("lake-layout.yaml", 1_902, 9_400),
  ],
  "acme-lake/samples/": samples.map(([name, size, minutes, storage]) =>
    file(`samples/${name}`, size, minutes, storage),
  ),
  "acme-lake/raw/": [
    dir("raw/events/"),
    dir("raw/orders/"),
    dir("raw/payments/"),
    dir("raw/stripe/"),
  ],
  "acme-lake/raw/events/": Array.from({ length: 30 }, (_, index) =>
    dir(
      `raw/events/dt=2026-11-${two(27 - index > 0 ? 27 - index : 1)}${27 - index > 0 ? "" : `-backfill-${index}`}/`,
    ),
  ),
  "acme-lake/curated/": [dir("curated/marts/"), dir("curated/dimensions/")],
  "acme-lake/curated/marts/": [
    dir("curated/marts/fct_revenue/"),
    dir("curated/marts/dim_accounts/"),
  ],
  "acme-lake/staging/": [dir("staging/loads/")],
  "acme-lake/tmp/": [],
};

const listings = new Map<string, Entry[]>();

/** Everything directly under a prefix, in S3's own order: by key. */
export function listPrefix(bucketName: string, prefix: string): Entry[] {
  const id = `${bucketName}/${prefix}`;
  const known = listings.get(id);
  if (known) return known;
  let entries = tree[id];
  if (!entries) {
    const big = /raw\/events\/dt=2026-11-27\/$/.test(prefix);
    const depth = prefix.split("/").length;
    entries =
      prefix === ""
        ? [dir("data/"), dir("exports/"), file("manifest.json", 1_920, 3_000)]
        : [
            ...(depth < 3 && !big
              ? [dir(`${prefix}2025/`), dir(`${prefix}2026/`)]
              : []),
            ...Array.from({ length: big ? 12_480 : 38 }, (_, index) =>
              file(
                `${prefix}part-${String(index).padStart(5, "0")}-8f1c2e.snappy.parquet`,
                2_000_000 + ((index * 7_919) % 9_000_000),
                5 + (index % 900),
              ),
            ),
            ...(big ? [] : [file(`${prefix}_SUCCESS`, 0, 6)]),
          ];
  }
  const sorted = [...entries].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
  listings.set(id, sorted);
  return sorted;
}

export interface Page {
  entries: Entry[];
  /** True when ListObjectsV2 would return a continuation token. */
  more: boolean;
}

/**
 * One ListObjectsV2 page. S3 filters by key prefix only, returns keys in
 * order, and says whether more follow, never how many.
 */
export function listPage(
  bucketName: string,
  prefix: string,
  startsWith: string,
  offset: number,
  size: number,
): Page {
  const matching = listPrefix(bucketName, prefix).filter((entry) =>
    nameOf(entry.key).startsWith(startsWith),
  );
  return {
    entries: matching.slice(offset, offset + size),
    more: offset + size < matching.length,
  };
}

export const findEntry = (bucketName: string, key: string) =>
  listPrefix(bucketName, parentOf(key)).find((entry) => entry.key === key);

export interface Upload {
  id: string;
  bucket: string;
  key: string;
  started: Date;
  parts: number;
}

/** Multipart uploads that were never completed; S3 keeps billing their parts. */
export const incompleteUploads: Upload[] = Array.from(
  { length: 23 },
  (_, index) => ({
    id: `upload-${index}`,
    bucket: "acme-lake",
    key:
      index % 3
        ? `staging/loads/export-${index}.parquet`
        : `raw/stripe/dump-${index}.jsonl.gz`,
    started: ago(300 + index * 2_300),
    parts: 1 + ((index * 17) % 240),
  }),
);

export interface Change {
  id: number;
  at: Date;
  operation: string;
  bucket: string;
  key: string;
}

const operations = [
  "Upload",
  "Delete",
  "Copy",
  "Move",
  "Create folder",
  "Share link",
];
export const changes: Change[] = Array.from({ length: 214 }, (_, index) => {
  const operation = operations[
    [0, 0, 2, 1, 0, 5, 3, 4, 1, 2][index % 10] ?? 0
  ] as string;
  return {
    id: index,
    at: ago(12 + index * 97),
    operation,
    bucket: index % 7 === 3 ? "acme-exports" : "acme-lake",
    key:
      operation === "Create folder"
        ? `staging/loads/run-${index}/`
        : index % 2
          ? `samples/${samples[index % samples.length]?.[0]}`
          : `staging/loads/batch-${index}.parquet`,
  };
});
