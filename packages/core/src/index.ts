/** Browser-safe contracts shared by dsui's server and application. */
export const BUILTIN_ADAPTER_IDS = [
  "trino",
  "clickhouse",
  "polaris",
  "kafka",
  "s3",
  "flink",
  "spark",
  "docker",
  "snowflake",
  "bigquery",
  "airflow",
  "redshift",
  "postgres",
  "databricks",
  "dagster",
  "dbt-cloud",
  "mock",
] as const;
export type BuiltinAdapterId = (typeof BUILTIN_ADAPTER_IDS)[number];

export type ServiceHealth = "healthy" | "warning" | "unavailable" | "unknown";

export interface HealthStatus {
  status: ServiceHealth;
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
}

export const CAPABILITY_KINDS = [
  "service-info",
  "query",
  "schema-browser",
  "table-browser",
  "topic-browser",
  "message-browser",
  "consumer-groups",
  "object-browser",
  "job-browser",
  "key-value-browser",
  "log-stream",
  "record-list",
  "record-detail",
  "action-form",
] as const;
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

export type AuthorizationClass = "inspect" | "execute";

export interface FieldDescriptor {
  id: string;
  label: string;
  description?: string;
  type: "text" | "password" | "number" | "boolean" | "url" | "list" | "select";
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  options?: readonly { label: string; value: string }[];
}

export interface TableColumn {
  id: string;
  label: string;
  format?: "text" | "code" | "number" | "bytes" | "timestamp" | "status";
}

export interface CapabilityView {
  /** A core-owned renderer identifier. Adapters never supply browser code. */
  kind: CapabilityKind;
  title: string;
  description?: string;
  columns?: readonly TableColumn[];
  filters?: readonly { id: string; label: string; type: "text" | "select" }[];
  actions?: readonly {
    id: string;
    label: string;
    authorization: AuthorizationClass;
  }[];
  dialect?: string;
  /** For list renderers: capability id invoked with the selected row's id. */
  detail?: string;
  /** Field of a list row passed to the `detail` capability (default "id"). */
  idField?: string;
}

export interface CapabilityDeclaration {
  id: string;
  authorization: AuthorizationClass;
  view: CapabilityView;
  supportsPagination?: boolean;
  supportsCancellation?: boolean;
  maxPageSize?: number;
}

export interface AdapterMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  /** Logo source: an https URL or a file path served at /api/v1/adapters/:id/logo. */
  logo?: string;
  docsUrl?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface ServiceInfo {
  label: string;
  value: string;
  format?: "text" | "code" | "status";
}
