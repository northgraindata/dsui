import { cn } from "@northgraindata/dsui-ui";
import { useState } from "react";
import airflowLogo from "../assets/brands/airflow.svg";
import bigqueryLogo from "../assets/brands/bigquery.svg";
import clickhouseLogo from "../assets/brands/clickhouse.svg";
import dagsterLogo from "../assets/brands/dagster.svg";
import databricksLogo from "../assets/brands/databricks.svg";
import dbtCloudLogo from "../assets/brands/dbt-cloud.svg";
import dockerLogo from "../assets/brands/docker.svg";
import flinkLogo from "../assets/brands/flink.svg";
import kafkaLogo from "../assets/brands/kafka.svg";
import polarisLogo from "../assets/brands/polaris.svg";
import postgresLogo from "../assets/brands/postgres.svg";
import redshiftLogo from "../assets/brands/redshift.svg";
import s3Logo from "../assets/brands/s3.svg";
import snowflakeLogo from "../assets/brands/snowflake.svg";
import sparkLogo from "../assets/brands/spark.svg";
import trinoLogo from "../assets/brands/trino.svg";
import { BrandGlyph } from "../logos";

const localBrandLogos: Record<string, string> = {
  airflow: airflowLogo,
  bigquery: bigqueryLogo,
  clickhouse: clickhouseLogo,
  dagster: dagsterLogo,
  databricks: databricksLogo,
  "dbt-cloud": dbtCloudLogo,
  docker: dockerLogo,
  flink: flinkLogo,
  kafka: kafkaLogo,
  polaris: polarisLogo,
  postgres: postgresLogo,
  redshift: redshiftLogo,
  s3: s3Logo,
  snowflake: snowflakeLogo,
  spark: sparkLogo,
  trino: trinoLogo,
};

export function ServiceMark({
  adapter,
  logo,
  size = 26,
  variant = "contained",
}: {
  adapter: string;
  logo?: string;
  size?: number;
  variant?: "contained" | "bare";
}) {
  const [failed, setFailed] = useState(false);
  const brandColors: Record<string, string> = {
    airflow: "#017cee",
    bigquery: "#669df6",
    clickhouse: "#ffcc01",
    dagster: "#4f43dd",
    databricks: "#ff3621",
    "dbt-cloud": "#ff694a",
    docker: "#2496ed",
    flink: "#e6526f",
    kafka: "#ffffff",
    polaris: "#a78bfa",
    postgres: "#4169e1",
    redshift: "#a166ff",
    s3: "#569a31",
    snowflake: "#29b5e8",
    spark: "#e25a1c",
    trino: "#dd00a1",
  };
  const classes = cn(
    "relative flex shrink-0 items-center justify-center",
    variant === "contained"
      ? "border border-border bg-surface-raised text-secondary"
      : "text-primary",
  );
  const style = {
    width: size,
    height: size,
    ...(variant === "bare" && { color: brandColors[adapter] }),
  };
  const imageLogo = logo ?? localBrandLogos[adapter];
  if (imageLogo && !failed)
    return (
      <span className={classes} style={style}>
        <img
          src={imageLogo}
          alt=""
          width={size - 8}
          height={size - 8}
          loading="lazy"
          className={cn("object-contain", variant === "contained" && "p-1")}
          onError={() => setFailed(true)}
        />
      </span>
    );
  const glyph = <BrandGlyph adapter={adapter} size={size - 8} />;
  if (glyph)
    return (
      <span
        className={cn(classes, variant === "contained" && "text-accent")}
        style={style}
      >
        {glyph}
      </span>
    );
  return (
    <span
      className={cn(classes, "font-mono text-[9.5px] font-semibold")}
      style={style}
    >
      {adapter.slice(0, 2).toUpperCase()}
    </span>
  );
}
