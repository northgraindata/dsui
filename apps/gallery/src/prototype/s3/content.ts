/* Invented file contents for the previews. */
const customer = (index: number) =>
  [
    `cus_${(184_220 + index * 37).toString(36)}`,
    ["Northwind", "Globex", "Initech", "Umbrella", "Hooli", "Stark Industries"][
      index % 6
    ] ?? "",
    ["DE", "PL", "US", "FR", "SE"][index % 5] ?? "",
    ["enterprise", "growth", "starter"][index % 3] ?? "",
    ((index * 7919) % 90_000) + 120,
    `2026-${String(1 + (index % 11)).padStart(2, "0")}-${String(1 + ((index * 3) % 27)).padStart(2, "0")}`,
  ] as const;

export const csvColumns = [
  "customer_id",
  "company",
  "country",
  "plan",
  "mrr_eur",
  "created_at",
];
export const csvRows = Array.from({ length: 100 }, (_, index) =>
  customer(index).map(String),
);

export const parquetSchema: [name: string, type: string, nullable: boolean][] =
  [
    ["order_id", "BYTE_ARRAY (string)", false],
    ["customer_id", "BYTE_ARRAY (string)", false],
    ["status", "BYTE_ARRAY (string)", false],
    ["amount", "INT64 (decimal 18,2)", false],
    ["currency", "BYTE_ARRAY (string)", false],
    ["created_at", "INT64 (timestamp, ms)", false],
    ["refunded_at", "INT64 (timestamp, ms)", true],
  ];
export const parquetRows = Array.from({ length: 100 }, (_, index) => [
  `ord_${900_100 + index}`,
  customer(index)[0],
  ["paid", "paid", "paid", "pending", "refunded"][index % 5] ?? "",
  (((index * 3571) % 400_000) / 100).toFixed(2),
  "EUR",
  `2026-11-26 ${String(index % 24).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}:11`,
  index % 5 === 4 ? "2026-11-27 08:02:44" : "null",
]);

export const records = Array.from({ length: 40 }, (_, index) => ({
  event_id: `evt_${771_000 + index}`,
  type: ["checkout.completed", "invoice.paid", "customer.updated"][index % 3],
  customer: customer(index)[0],
  amount: (index * 13) % 500,
  livemode: true,
  received_at: `2026-11-27T10:${String(index).padStart(2, "0")}:07Z`,
}));

export const json = JSON.stringify(
  {
    metadata: {
      dbt_version: "1.9.2",
      generated_at: "2026-11-27T01:00:12Z",
      project_name: "acme_analytics",
    },
    nodes: Object.fromEntries(
      ["fct_revenue", "dim_accounts", "stg_orders", "stg_payments"].map(
        (name) => [
          `model.acme_analytics.${name}`,
          {
            name,
            materialized: name.startsWith("stg") ? "view" : "table",
            tags: ["marts"],
            depends_on: [],
            enabled: true,
            rows: null,
          },
        ],
      ),
    ),
  },
  null,
  2,
);

export const code: Record<string, string> = {
  "load_orders.py": `import io\nfrom datetime import date\n\nimport boto3\nimport pyarrow.parquet as pq\n\nBUCKET = "acme-lake"\n\n\ndef load(day: date) -> int:\n    """Loads one day of orders into the warehouse."""\n    s3 = boto3.client("s3")\n    key = f"raw/orders/dt={day:%Y-%m-%d}/orders.parquet"\n    body = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()\n    table = pq.read_table(io.BytesIO(body))\n    # Rows without an amount are test orders.\n    return table.filter(table["amount"].is_valid()).num_rows\n`,
  "revenue_by_day.sql": `-- Revenue per day, in euros\nSELECT\n    date_trunc('day', created_at) AS day,\n    count(*)                      AS orders,\n    sum(amount)                   AS revenue_eur\nFROM marts.fct_revenue\nWHERE status = 'paid'\n  AND created_at >= current_date - INTERVAL '30 days'\nGROUP BY 1\nORDER BY 1 DESC;\n`,
  "pipeline.yaml": `name: daily-revenue\nschedule: "0 5 * * *"\nowner: analytics\nsources:\n  - uri: s3://acme-lake/raw/orders/\n    format: parquet\n  - uri: s3://acme-lake/raw/payments/\n    format: parquet\nretries: 2\nalerts:\n  slack: "#data-alerts"\n`,
  "deploy.sh": `#!/usr/bin/env bash\nset -euo pipefail\n\naws s3 sync ./dags "s3://acme-airflow/dags" --delete\necho "Deployed $(git rev-parse --short HEAD)"\n`,
  "lake-layout.yaml": `zones:\n  raw: "Exactly what the source sent"\n  staging: "Cleaned and typed"\n  curated: "What people query"\n`,
};

export const log = Array.from({ length: 120 }, (_, index) => {
  const level =
    index % 41 === 17 ? "ERROR" : index % 13 === 6 ? "WARNING" : "INFO";
  const message =
    level === "ERROR"
      ? "Connection reset by peer while reading part 14, retrying"
      : level === "WARNING"
        ? "Slow response from s3: 4.2 s"
        : `Processed batch ${index + 1} (5,000 rows)`;
  return `[2026-11-27 05:${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}] ${level.padEnd(7)} ${message}`;
});

export const markdown = `# acme-lake\n\nThe company's data lake. **Do not write by hand** to curated/.\n\n## Zones\n\n- raw/ holds exactly what a source sent\n- staging/ is cleaned and typed\n- curated/ is what people query\n\n## Loading a day\n\n\`\`\`\npython load_orders.py --day 2026-11-26\n\`\`\`\n\nQuestions go to #data-platform.`;

export const notebook = [
  {
    type: "markdown",
    source: "## Churn model\n\nFeatures per account, last 90 days.",
  },
  {
    type: "code",
    source:
      'import pandas as pd\n\ndf = pd.read_parquet("s3://acme-lake/curated/dimensions/accounts/")\ndf.shape',
    output: "(48210, 31)",
  },
  { type: "code", source: 'df["churned"].mean().round(4)', output: "0.0412" },
] as const;

export const archiveFiles: [name: string, size: number][] = [
  ["partner-drop/manifest.json", 2_114],
  ["partner-drop/accounts.csv", 31_220_004],
  ["partner-drop/orders.csv", 58_104_331],
  ["partner-drop/images/logo.png", 48_220],
  ["partner-drop/README.txt", 612],
];

export const hexHead = Array.from({ length: 14 }, (_, row) => {
  const values = Array.from({ length: 16 }, (_, column) =>
    row === 0 && column < 4
      ? ([0x50, 0x4b, 0x54, 0x31][column] ?? 0)
      : (row * 53 + column * 97 + 11) % 256,
  );
  return `${(row * 16).toString(16).padStart(8, "0")}  ${values.map((value) => value.toString(16).padStart(2, "0")).join(" ")}  ${values.map((value) => (value > 31 && value < 127 ? String.fromCharCode(value) : ".")).join("")}`;
}).join("\n");
