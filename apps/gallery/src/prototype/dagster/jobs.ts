import { type AssetDef, assets } from "./graph";

export interface JobDef {
  name: string;
  description: string;
  location: string;
  /** Asset keys, or op names for a job that materializes nothing. */
  assets: string[];
  ops?: string[];
  /** Minutes between scheduled runs, and the minute they start. */
  every?: number;
  offset?: number;
  cron?: string;
  cronText?: string;
  /** The concurrency pool its steps take a slot from. */
  pool?: string;
}

const inGroups = (...names: string[]) =>
  assets.filter((asset) => names.includes(asset.group)).map((a) => a.key);

const sourceNames: Record<string, string> = {
  stripe: "Stripe",
  salesforce: "Salesforce",
  shopify: "Shopify",
  app_postgres: "the application database",
  segment: "Segment",
  hubspot: "HubSpot",
};

const ingest = (
  source: string,
  every: number,
  offset: number,
  cron: string,
  cronText: string,
): JobDef => ({
  name: `ingest_${source}`,
  description: `Loads ${sourceNames[source] ?? source} into the warehouse.`,
  location: "ingestion",
  assets: inGroups(`raw_${source}`),
  every,
  offset,
  cron,
  cronText,
  pool: "fivetran_api",
});

export const jobs: JobDef[] = [
  ingest("stripe", 60, 0, "0 * * * *", "Every hour"),
  ingest("salesforce", 120, 10, "10 */2 * * *", "Every 2 hours at :10"),
  ingest("shopify", 60, 15, "15 * * * *", "Every hour at :15"),
  ingest("app_postgres", 30, 25, "25,55 * * * *", "Every 30 minutes"),
  ingest("segment", 60, 5, "5 * * * *", "Every hour at :05"),
  ingest("hubspot", 360, 40, "40 */6 * * *", "Every 6 hours at :40"),
  {
    name: "dbt_staging_build",
    description: "Builds the dbt staging models.",
    location: "analytics",
    assets: inGroups("staging"),
    every: 60,
    offset: 20,
    cron: "20 * * * *",
    cronText: "Every hour at :20",
    pool: "snowflake_transform",
  },
  {
    name: "dbt_core_build",
    description: "Builds dimensions and facts.",
    location: "analytics",
    assets: inGroups("core"),
    every: 60,
    offset: 35,
    cron: "35 * * * *",
    cronText: "Every hour at :35",
    pool: "snowflake_transform",
  },
  {
    name: "finance_marts",
    description: "Revenue, subscriptions and the board's numbers.",
    location: "analytics",
    assets: inGroups("marts_finance"),
    every: 1440,
    offset: 360,
    cron: "0 6 * * *",
    cronText: "Daily at 06:00",
    pool: "snowflake_transform",
  },
  {
    name: "marketing_marts",
    description: "Attribution, campaigns and the lead funnel.",
    location: "analytics",
    assets: inGroups("marts_marketing"),
    every: 1440,
    offset: 420,
    cron: "0 7 * * *",
    cronText: "Daily at 07:00",
    pool: "snowflake_transform",
  },
  {
    name: "product_marts",
    description: "Product usage, activation and retention.",
    location: "analytics",
    assets: inGroups("marts_product"),
    every: 180,
    offset: 50,
    cron: "50 */3 * * *",
    cronText: "Every 3 hours at :50",
    pool: "snowflake_transform",
  },
  {
    name: "ml_training",
    description: "Retrains the churn and lead models.",
    location: "ml",
    assets: inGroups("ml_features", "ml_models").filter(
      (key) => !key.endsWith("expansion_model") && !key.endsWith("_scores"),
    ),
    every: 10_080,
    offset: 120,
    cron: "0 2 * * 1",
    cronText: "Mondays at 02:00",
    pool: "ml_gpu",
  },
  {
    name: "ml_scoring",
    description: "Scores customers and leads with the latest models.",
    location: "ml",
    assets: ["ml_models/churn_scores", "ml_models/lead_scores"],
    every: 1440,
    offset: 480,
    cron: "0 8 * * *",
    cronText: "Daily at 08:00",
  },
  {
    name: "reverse_etl_sync",
    description: "Sends scores and metrics to the tools people work in.",
    location: "reverse_etl",
    assets: inGroups("activation").filter(
      (key) => !key.endsWith("expansion_flags"),
    ),
  },
  {
    name: "warehouse_maintenance",
    description: "Drops stale tables and reports warehouse cost. An op job.",
    location: "analytics",
    assets: [],
    ops: [
      "list_stale_tables",
      "drop_stale_tables",
      "prune_query_history",
      "report_warehouse_cost",
    ],
    every: 1440,
    offset: 180,
    cron: "0 3 * * *",
    cronText: "Daily at 03:00",
  },
];

export const jobByName = new Map(jobs.map((job) => [job.name, job]));

export const jobsOf = (asset: AssetDef) =>
  jobs.filter((job) => job.assets.includes(asset.key));
