import { clickhouseIconUrl } from "../../../../../packages/adapter-clickhouse/src/logo";
import { duckdbIconUrl } from "../../../../../packages/adapter-duckdb/src/logo";
import { postgresqlIconUrl } from "../../../../../packages/adapter-postgresql/src/logo";
import { s3IconUrl } from "../../../../../packages/adapter-s3/src/logo";
import { snowflakeIconUrl } from "../../../../../packages/adapter-snowflake/src/icon";
import aws from "./brands/aws.svg";
import googleCloud from "./brands/google-cloud.svg";
import mysql from "./brands/mysql.svg";
import redshift from "./brands/redshift.svg";
import slack from "./brands/slack.svg";
import { Glyph } from "./icons";

/*
 * Keyed by Airflow's `conn_type`. A known system shows its logo on a tile in
 * its colour. Everything else, protocols included, gets one generic mark.
 */
const brands: Record<string, { logo: string; colour?: string }> = {
  postgres: { logo: postgresqlIconUrl, colour: "#4d8fd6" },
  snowflake: { logo: snowflakeIconUrl, colour: "#29b5e8" },
  s3: { logo: s3IconUrl, colour: "#6cae3e" },
  duckdb: { logo: duckdbIconUrl, colour: "#fff000" },
  clickhouse: { logo: clickhouseIconUrl, colour: "#faff69" },
  aws: { logo: aws, colour: "#ff9900" },
  redshift: { logo: redshift },
  slack: { logo: slack, colour: "#a74ba8" },
  mysql: { logo: mysql, colour: "#00a3c4" },
  google_cloud_platform: { logo: googleCloud, colour: "#4285f4" },
};

/* One convention: the product's full name, as its vendor writes it. */
const names: Record<string, string> = {
  aws: "Amazon Web Services",
  clickhouse: "ClickHouse",
  duckdb: "DuckDB",
  google_cloud_platform: "Google Cloud Platform",
  http: "HTTP",
  mysql: "MySQL",
  postgres: "PostgreSQL",
  redshift: "Amazon Redshift",
  s3: "Amazon S3",
  sftp: "SFTP",
  slack: "Slack",
  snowflake: "Snowflake",
};

/** The name of an Airflow `conn_type`; an unlisted one is made readable. */
export function connectionTypeName(type: string): string {
  const known = names[type];
  if (known) return known;
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Select options for connection types, in the order of their names. */
export function connectionTypeOptions(types: readonly string[]) {
  return [...types]
    .sort((a, b) => connectionTypeName(a).localeCompare(connectionTypeName(b)))
    .map((value) => ({
      value,
      label: connectionTypeName(value),
      icon: <ConnectionMark type={value} />,
    }));
}

export function ConnectionMark({ type }: { type: string }) {
  const brand = brands[type];
  if (!brand)
    return (
      <span className="ax-mark" aria-hidden="true">
        <Glyph name="plug" size={16} />
      </span>
    );
  return (
    <span
      className="ax-mark"
      data-brand={brand.colour ? "tinted" : "filled"}
      style={{ "--mark": brand.colour } as React.CSSProperties}
    >
      <img src={brand.logo} alt="" />
    </span>
  );
}
