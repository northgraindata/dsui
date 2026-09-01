import { airflowAdapter } from "@northgraindata/dsui-adapter-airflow";
import { bigqueryAdapter } from "@northgraindata/dsui-adapter-bigquery";
import { clickhouseAdapter } from "@northgraindata/dsui-adapter-clickhouse";
import { dagsterAdapter } from "@northgraindata/dsui-adapter-dagster";
import { databricksAdapter } from "@northgraindata/dsui-adapter-databricks";
import { dbtCloudAdapter } from "@northgraindata/dsui-adapter-dbt-cloud";
import { dockerAdapter } from "@northgraindata/dsui-adapter-docker";
import { flinkAdapter } from "@northgraindata/dsui-adapter-flink";
import { kafkaAdapter } from "@northgraindata/dsui-adapter-kafka";
import { mockAdapter } from "@northgraindata/dsui-adapter-mock";
import { polarisAdapter } from "@northgraindata/dsui-adapter-polaris";
import { postgresAdapter } from "@northgraindata/dsui-adapter-postgres";
import { redshiftAdapter } from "@northgraindata/dsui-adapter-redshift";
import { s3Adapter } from "@northgraindata/dsui-adapter-s3";
import type { AdapterDefinition } from "@northgraindata/dsui-adapter-sdk";
import { snowflakeAdapter } from "@northgraindata/dsui-adapter-snowflake";
import { sparkAdapter } from "@northgraindata/dsui-adapter-spark";
import { trinoAdapter } from "@northgraindata/dsui-adapter-trino";
import type { AdapterMetadata } from "@northgraindata/dsui-core";

export type RegisteredAdapter = AdapterDefinition;

export class AdapterRegistry {
  private readonly adapters = new Map<string, RegisteredAdapter>();

  constructor(
    adapters: readonly RegisteredAdapter[] = [
      trinoAdapter,
      clickhouseAdapter,
      polarisAdapter,
      kafkaAdapter,
      s3Adapter,
      flinkAdapter,
      sparkAdapter,
      dockerAdapter,
      snowflakeAdapter,
      bigqueryAdapter,
      airflowAdapter,
      redshiftAdapter,
      postgresAdapter,
      databricksAdapter,
      dagsterAdapter,
      dbtCloudAdapter,
      mockAdapter,
    ],
  ) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: RegisteredAdapter): void {
    if (this.adapters.has(adapter.id))
      throw new Error(`Adapter is already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  /** Restores the given definitions, dropping previously applied overrides. */
  reset(adapters: readonly RegisteredAdapter[]): void {
    this.adapters.clear();
    for (const adapter of adapters) this.register(adapter);
  }

  /** Applies a config-driven presentation patch; unknown ids are ignored. */
  applyMetadata(id: string, patch: Partial<AdapterMetadata>): void {
    const base = this.adapters.get(id);
    if (!base) return;
    this.adapters.set(id, {
      ...base,
      metadata: { ...base.metadata, ...patch },
    });
  }

  get(id: string): RegisteredAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown adapter: ${id}`);
    return adapter;
  }

  list(): RegisteredAdapter[] {
    return [...this.adapters.values()];
  }
}

export function publicAdapter(adapter: RegisteredAdapter) {
  return {
    id: adapter.id,
    name: adapter.metadata.name,
    category: adapter.metadata.category,
    description: adapter.metadata.description,
    ...(adapter.metadata.logo
      ? { logo: `/api/v1/adapters/${adapter.id}/logo` }
      : {}),
    fields: adapter.connectionFields.map((field) => ({
      key: field.id,
      label: field.label,
      type: field.type === "url" ? "text" : field.type,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options,
    })),
  };
}

export function endpointFor(
  adapterId: string,
  connection: Record<string, unknown>,
): string {
  if (adapterId === "trino")
    return `${String(connection.host ?? "")}:${String(connection.port ?? 8080)}`;
  if (adapterId === "clickhouse")
    return `${String(connection.host ?? "")}:${String(connection.port ?? 8123)}`;
  if (adapterId === "polaris") return String(connection.baseUrl ?? "");
  if (adapterId === "kafka")
    return Array.isArray(connection.brokers)
      ? connection.brokers.join(", ")
      : String(connection.brokers ?? "");
  if (adapterId === "s3") return String(connection.endpoint ?? "");
  if (adapterId === "flink") return String(connection.url ?? "");
  if (adapterId === "spark") return String(connection.url ?? "");
  if (adapterId === "docker") return String(connection.container ?? "");
  if (adapterId === "snowflake")
    return String(
      connection.host ??
        `${String(connection.accountIdentifier ?? "")}.snowflakecomputing.com`,
    );
  if (adapterId === "bigquery") return String(connection.projectId ?? "");
  if (adapterId === "airflow") return String(connection.baseUrl ?? "");
  if (adapterId === "redshift" || adapterId === "postgres")
    return `${String(connection.host ?? "")}:${String(
      connection.port ?? (adapterId === "redshift" ? 5439 : 5432),
    )}`;
  if (adapterId === "databricks") return String(connection.workspaceUrl ?? "");
  if (adapterId === "dagster") return String(connection.baseUrl ?? "");
  if (adapterId === "dbt-cloud") return String(connection.baseUrl ?? "");
  if (adapterId === "mock")
    return `mock://${String(connection.serviceType ?? "snowflake")}/${String(connection.preset ?? "realistic")}`;
  return "configured";
}

/** Makes browser form values fit built-in connection schemas without exposing secrets. */
export function normalizeConnection(
  adapterId: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const connection = { ...raw };
  delete connection.name;
  if (adapterId === "kafka" && typeof connection.brokers === "string")
    connection.brokers = connection.brokers
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean);
  if (adapterId === "kafka" && typeof connection.connectUrls === "string")
    connection.connectUrls = connection.connectUrls
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  for (const key of ["ssl", "forcePathStyle"])
    if (typeof connection[key] === "string")
      connection[key] = connection[key] === "true";
  return connection;
}
