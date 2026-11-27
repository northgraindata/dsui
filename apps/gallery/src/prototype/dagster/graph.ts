/* Definitions: the assets of a mid-sized company and how they depend. */

export interface AssetDef {
  /** The asset key, joined with "/". Its last part is the name. */
  key: string;
  name: string;
  group: string;
  location: string;
  kinds: string[];
  description: string;
  owner: string;
  deps: string[];
  partitioned?: "daily" | "monthly";
}

const owners = [
  "data-platform",
  "analytics",
  "finance-data",
  "growth",
  "ml-team",
];

export const assets: AssetDef[] = [];
const byName = new Map<string, AssetDef>();

function add(
  group: string,
  name: string,
  location: string,
  kinds: string[],
  deps: string[],
  extra: Partial<AssetDef> = {},
) {
  const asset: AssetDef = {
    key: `${group}/${name}`,
    name,
    group,
    location,
    kinds,
    deps: deps.map((dep) => {
      const found = byName.get(dep);
      if (!found) throw new Error(`Unknown dependency ${dep} of ${name}`);
      return found.key;
    }),
    description: "",
    owner: "data-platform",
    ...extra,
  };
  assets.push(asset);
  byName.set(name, asset);
}

const sources: [string, string, string[]][] = [
  [
    "stripe",
    "fivetran",
    "charges refunds invoices invoice_lines customers subscriptions payouts disputes prices products coupons events",
  ],
  [
    "salesforce",
    "fivetran",
    "accounts contacts opportunities leads campaigns tasks users activities",
  ],
  [
    "shopify",
    "airbyte",
    "orders order_lines products variants customers fulfillments inventory_levels discounts",
  ],
  [
    "app_postgres",
    "airbyte",
    "users organizations memberships projects workspaces api_keys feature_flags audit_events sessions invitations",
  ],
  ["segment", "dlt", "page_views track_events identifies screen_views signups"],
  ["hubspot", "sling", "companies deals email_events forms ad_spend"],
].map(([source, tool, tables]) => [
  source as string,
  tool as string,
  (tables as string).split(" "),
]);

const daily = new Set([
  "events",
  "audit_events",
  "page_views",
  "track_events",
  "email_events",
  "sessions",
  "screen_views",
]);

for (const [source, tool, tables] of sources)
  for (const name of tables)
    add(
      `raw_${source}`,
      `${source}_${name}`,
      "ingestion",
      [tool, "snowflake"],
      [],
      {
        description: `The ${name.replaceAll("_", " ")} table as ${source} sends it.`,
        partitioned: daily.has(name) ? "daily" : undefined,
      },
    );

for (const [source, , tables] of sources)
  for (const name of tables)
    add(
      "staging",
      `stg_${source}__${name}`,
      "analytics",
      ["dbt", "snowflake"],
      [`${source}_${name}`],
      {
        description: `Renamed and typed ${name.replaceAll("_", " ")} from ${source}.`,
        owner: "analytics",
        partitioned: daily.has(name) ? "daily" : undefined,
      },
    );

const stg = (...names: string[]) => names.map((name) => `stg_${name}`);
const core: [string, string[], string, AssetDef["partitioned"]?][] = [
  [
    "dim_customers",
    stg("stripe__customers", "app_postgres__users", "salesforce__accounts"),
    "One row per paying or trial customer.",
  ],
  [
    "dim_accounts",
    stg(
      "salesforce__accounts",
      "hubspot__companies",
      "app_postgres__organizations",
    ),
    "Companies, matched across sales and product.",
  ],
  [
    "dim_users",
    stg(
      "app_postgres__users",
      "app_postgres__memberships",
      "segment__identifies",
    ),
    "Product users with their organization.",
  ],
  [
    "dim_products",
    stg("stripe__products", "stripe__prices", "shopify__products"),
    "Every sellable product and its price.",
  ],
  [
    "fct_charges",
    stg("stripe__charges", "stripe__refunds", "stripe__disputes"),
    "Card charges net of refunds and disputes.",
    "daily",
  ],
  [
    "fct_invoices",
    stg("stripe__invoices", "stripe__invoice_lines", "stripe__coupons"),
    "Invoices with their lines and discounts.",
    "daily",
  ],
  [
    "fct_subscriptions",
    stg("stripe__subscriptions", "stripe__prices"),
    "Subscription state for each day.",
    "daily",
  ],
  [
    "fct_orders",
    stg("shopify__orders", "shopify__order_lines", "shopify__discounts"),
    "Shop orders, one row each.",
    "daily",
  ],
  [
    "fct_opportunities",
    stg("salesforce__opportunities", "salesforce__leads"),
    "The sales pipeline.",
  ],
  [
    "fct_page_views",
    stg("segment__page_views", "segment__screen_views"),
    "Web and app views.",
    "daily",
  ],
  [
    "fct_product_events",
    stg(
      "segment__track_events",
      "app_postgres__audit_events",
      "app_postgres__sessions",
    ),
    "What users do in the product.",
    "daily",
  ],
  [
    "fct_marketing_touches",
    stg("hubspot__email_events", "hubspot__forms", "salesforce__campaigns"),
    "Every marketing contact with a lead.",
    "daily",
  ],
];
for (const [name, deps, description, partitioned] of core)
  add("core", name, "analytics", ["dbt", "snowflake"], deps, {
    description,
    owner: "analytics",
    partitioned,
  });

const marts: [string, string, string[]][] = [
  ["marts_finance", "revenue_daily", ["fct_charges", "fct_invoices"]],
  ["marts_finance", "mrr_by_plan", ["fct_subscriptions", "dim_products"]],
  ["marts_finance", "arr_bridge", ["mrr_by_plan", "dim_customers"]],
  ["marts_finance", "revenue_recognition", ["fct_invoices", "dim_products"]],
  ["marts_finance", "accounts_receivable", ["fct_invoices", "dim_accounts"]],
  [
    "marts_finance",
    "payout_reconciliation",
    ["fct_charges", "stg_stripe__payouts"],
  ],
  ["marts_finance", "churn_cohorts", ["fct_subscriptions", "dim_customers"]],
  [
    "marts_finance",
    "board_metrics",
    ["arr_bridge", "revenue_daily", "churn_cohorts"],
  ],
  [
    "marts_marketing",
    "attribution_first_touch",
    ["fct_marketing_touches", "dim_accounts"],
  ],
  [
    "marts_marketing",
    "attribution_multi_touch",
    ["fct_marketing_touches", "fct_opportunities"],
  ],
  [
    "marts_marketing",
    "campaign_performance",
    ["attribution_multi_touch", "stg_hubspot__ad_spend"],
  ],
  ["marts_marketing", "lead_funnel", ["fct_opportunities", "fct_page_views"]],
  [
    "marts_marketing",
    "cac_by_channel",
    ["campaign_performance", "dim_customers"],
  ],
  ["marts_product", "daily_active_users", ["fct_product_events", "dim_users"]],
  [
    "marts_product",
    "feature_adoption",
    ["fct_product_events", "stg_app_postgres__feature_flags"],
  ],
  [
    "marts_product",
    "activation_funnel",
    ["fct_page_views", "fct_product_events", "dim_users"],
  ],
  ["marts_product", "workspace_health", ["daily_active_users", "dim_accounts"]],
  ["marts_product", "retention_weekly", ["daily_active_users"]],
];
for (const [group, name, deps] of marts)
  add(group, name, "analytics", ["dbt", "snowflake"], deps, {
    description: `${name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())} for reporting.`,
    owner:
      group === "marts_finance"
        ? "finance-data"
        : group === "marts_marketing"
          ? "growth"
          : "analytics",
    partitioned:
      name === "daily_active_users" || name === "revenue_daily"
        ? "daily"
        : name === "revenue_recognition"
          ? "monthly"
          : undefined,
  });

const ml: [string, string, string[], string[]][] = [
  [
    "ml_features",
    "customer_features",
    ["dim_customers", "fct_charges", "fct_product_events"],
    ["python", "pandas"],
  ],
  [
    "ml_features",
    "account_features",
    ["dim_accounts", "workspace_health"],
    ["python", "polars"],
  ],
  [
    "ml_features",
    "lead_features",
    ["lead_funnel", "attribution_multi_touch"],
    ["python", "pandas"],
  ],
  [
    "ml_models",
    "churn_training_set",
    ["customer_features", "churn_cohorts"],
    ["python", "parquet"],
  ],
  [
    "ml_models",
    "churn_model",
    ["churn_training_set"],
    ["python", "scikitlearn", "mlflow"],
  ],
  [
    "ml_models",
    "churn_scores",
    ["churn_model", "customer_features"],
    ["python", "snowflake"],
  ],
  [
    "ml_models",
    "lead_scoring_model",
    ["lead_features"],
    ["python", "xgboost", "mlflow"],
  ],
  [
    "ml_models",
    "lead_scores",
    ["lead_scoring_model", "lead_features"],
    ["python", "snowflake"],
  ],
  ["ml_models", "expansion_model", ["account_features"], ["python", "pytorch"]],
];
for (const [group, name, deps, kinds] of ml)
  add(group, name, "ml", kinds, deps, {
    description: `${name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}, rebuilt from the warehouse.`,
    owner: "ml-team",
  });

const activation: [string, string[], string[]][] = [
  ["hubspot_lead_scores", ["lead_scores"], ["census", "hubspot"]],
  [
    "salesforce_account_health",
    ["workspace_health", "churn_scores"],
    ["hightouch", "salesforce"],
  ],
  [
    "salesforce_expansion_flags",
    ["expansion_model", "dim_accounts"],
    ["hightouch", "salesforce"],
  ],
  ["slack_revenue_digest", ["board_metrics"], ["python", "slack"]],
  [
    "tableau_finance_extract",
    ["board_metrics", "accounts_receivable"],
    ["tableau"],
  ],
  [
    "looker_product_dashboards",
    ["feature_adoption", "retention_weekly", "activation_funnel"],
    ["looker"],
  ],
];
for (const [name, deps, kinds] of activation)
  add("activation", name, "reverse_etl", kinds, deps, {
    description: `Sends ${name.replaceAll("_", " ")} where people work.`,
    owner: owners[name.startsWith("tableau") ? 2 : 3] as string,
  });

export const assetByKey = new Map(assets.map((asset) => [asset.key, asset]));
export const downstream = new Map<string, string[]>(
  assets.map((asset) => [asset.key, []]),
);
for (const asset of assets)
  for (const dep of asset.deps) downstream.get(dep)?.push(asset.key);

export const groups = [...new Set(assets.map((asset) => asset.group))];

/** Everything reachable from the keys, one way. The keys are not included. */
export function reach(
  keys: readonly string[],
  direction: "up" | "down",
): Set<string> {
  const found = new Set<string>();
  const queue = [...keys];
  while (queue.length) {
    const key = queue.pop() as string;
    const next =
      direction === "up"
        ? (assetByKey.get(key)?.deps ?? [])
        : (downstream.get(key) ?? []);
    for (const other of next)
      if (!found.has(other)) {
        found.add(other);
        queue.push(other);
      }
  }
  for (const key of keys) found.delete(key);
  return found;
}
