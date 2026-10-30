/**
 * Display style for Dagster asset kinds. Kinds are free-form strings set in
 * definitions or by integrations; the common ones get a recognisable colour
 * and short glyph, anything else falls back to a neutral tag.
 */
export interface KindStyle {
  label: string;
  glyph: string;
  /** Mid-tone brand colour, legible on both light and dark surfaces. */
  color?: string;
}

const KINDS: Record<string, KindStyle> = {
  dbt: { label: "dbt", glyph: "dbt", color: "#FF694B" },
  python: { label: "Python", glyph: "Py", color: "#4B8BBE" },
  pandas: { label: "pandas", glyph: "pd", color: "#8B6FE0" },
  polars: { label: "Polars", glyph: "pl", color: "#3B82F6" },
  sql: { label: "SQL", glyph: "SQL", color: "#6B9BD1" },
  snowflake: { label: "Snowflake", glyph: "❄", color: "#29B5E8" },
  bigquery: { label: "BigQuery", glyph: "BQ", color: "#4285F4" },
  redshift: { label: "Redshift", glyph: "RS", color: "#8C4FFF" },
  postgres: { label: "Postgres", glyph: "PG", color: "#5B8FC7" },
  mysql: { label: "MySQL", glyph: "My", color: "#3E8DBA" },
  duckdb: { label: "DuckDB", glyph: "Dk", color: "#D9A800" },
  motherduck: { label: "MotherDuck", glyph: "MD", color: "#D9A800" },
  clickhouse: { label: "ClickHouse", glyph: "CH", color: "#D9B400" },
  databricks: { label: "Databricks", glyph: "DB", color: "#FF3621" },
  spark: { label: "Spark", glyph: "Sp", color: "#E25A1C" },
  s3: { label: "S3", glyph: "S3", color: "#569A31" },
  gcs: { label: "GCS", glyph: "GCS", color: "#4285F4" },
  azure: { label: "Azure", glyph: "Az", color: "#0089D6" },
  delta: { label: "Delta Lake", glyph: "Δ", color: "#00ADD4" },
  iceberg: { label: "Iceberg", glyph: "Ic", color: "#2F9BD6" },
  parquet: { label: "Parquet", glyph: "Pq", color: "#50ABF1" },
  fivetran: { label: "Fivetran", glyph: "Ft", color: "#2B8CFF" },
  airbyte: { label: "Airbyte", glyph: "Ab", color: "#615EFF" },
  dlt: { label: "dlt", glyph: "dlt", color: "#59C1D5" },
  sling: { label: "Sling", glyph: "Sl", color: "#2C7BE5" },
  stripe: { label: "Stripe", glyph: "St", color: "#7A73FF" },
  kafka: { label: "Kafka", glyph: "Kf", color: "#9A9A9A" },
  airflow: { label: "Airflow", glyph: "Af", color: "#1E90FF" },
  tableau: { label: "Tableau", glyph: "Tb", color: "#E97627" },
  looker: { label: "Looker", glyph: "Lk", color: "#4285F4" },
  powerbi: { label: "Power BI", glyph: "BI", color: "#E0B000" },
  metabase: { label: "Metabase", glyph: "Mb", color: "#509EE3" },
  sigma: { label: "Sigma", glyph: "Σ", color: "#9A9A9A" },
  hex: { label: "Hex", glyph: "Hx", color: "#F5A3C7" },
  jupyter: { label: "Jupyter", glyph: "Jn", color: "#F37626" },
  "scikit-learn": { label: "scikit-learn", glyph: "SK", color: "#F7931E" },
  pytorch: { label: "PyTorch", glyph: "PT", color: "#EE4C2C" },
  tensorflow: { label: "TensorFlow", glyph: "TF", color: "#FF8F00" },
  openai: { label: "OpenAI", glyph: "AI", color: "#10A37F" },
  anthropic: { label: "Anthropic", glyph: "A", color: "#D97757" },
  mongodb: { label: "MongoDB", glyph: "Mg", color: "#47A248" },
  redis: { label: "Redis", glyph: "Rd", color: "#DC382D" },
  slack: { label: "Slack", glyph: "Sk", color: "#E01E5A" },
  excel: { label: "Excel", glyph: "X", color: "#2E9C5E" },
  googlesheets: { label: "Sheets", glyph: "Gs", color: "#0F9D58" },
  census: { label: "Census", glyph: "Cs", color: "#6E62F0" },
  hightouch: { label: "Hightouch", glyph: "Ht", color: "#2BB673" },
  dagster: { label: "Dagster", glyph: "Dg", color: "#7A6FF0" },
  op: { label: "Op", glyph: "op" },
};

const ALIASES: Record<string, string> = {
  postgresql: "postgres",
  pyspark: "spark",
  sklearn: "scikit-learn",
  scikit_learn: "scikit-learn",
  deltalake: "delta",
  "delta-lake": "delta",
  "power bi": "powerbi",
  "google sheets": "googlesheets",
  notebook: "jupyter",
  ipynb: "jupyter",
  torch: "pytorch",
};

export function kindKey(kind: string): string {
  const key = kind.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

export function kindStyle(kind: string): KindStyle {
  return (
    KINDS[kindKey(kind)] ?? {
      label: kind,
      glyph: kind.slice(0, 2).toUpperCase(),
    }
  );
}
