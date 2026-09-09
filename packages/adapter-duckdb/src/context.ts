import { z } from "@northgraindata/dsui-adapter-sdk";

/**
 * DuckDB reference adapter context: runtime dependencies for one
 * configured instance. Holds the client and logger only — never UI
 * state (selected schema, editor content live in stores).
 */

/**
 * The web form submits booleans as "true"/"false" strings, and as "" when
 * the select is left on its placeholder. Coerce all three; "" maps to the
 * same value the default would give.
 */
const booleanish = z.preprocess(
  (value) =>
    value === "true" ? true : value === "false" || value === "" ? false : value,
  z.boolean(),
);

export const duckdbConnectionMethods = {
  memory: {
    label: "In-memory",
    description: "An ephemeral :memory: database created per connection.",
    schema: z.object({
      readOnly: booleanish.default(false),
    }),
  },
  file: {
    label: "Local file",
    description: "A .duckdb file on the server's filesystem.",
    schema: z.object({
      path: z.string().min(1),
      readOnly: booleanish.default(false),
    }),
  },
  remote: {
    label: "Remote",
    description: "Object storage, servers, and databases.",
    methods: {
      s3: {
        label: "S3 / S3-compatible",
        description: "S3, MinIO, and other S3-API storage via httpfs.",
        schema: z.object({
          url: z.string().min(1),
          readOnly: booleanish.default(false),
          s3AccessKeyId: z.string().optional(),
          s3SecretAccessKey: z.string().optional(),
          s3SessionToken: z.string().optional(),
          s3Region: z.string().optional(),
          s3Endpoint: z.string().optional(),
        }),
      },
      gcs: {
        label: "Google Cloud Storage",
        description: "GCS buckets via the S3 API (HMAC keys).",
        schema: z.object({
          url: z.string().min(1),
          readOnly: booleanish.default(false),
          gcsKeyId: z.string().optional(),
          gcsSecret: z.string().optional(),
        }),
      },
      r2: {
        label: "Cloudflare R2",
        description: "R2 buckets via the S3 API.",
        schema: z.object({
          url: z.string().min(1),
          readOnly: booleanish.default(false),
          r2KeyId: z.string().optional(),
          r2Secret: z.string().optional(),
          r2AccountId: z.string().optional(),
        }),
      },
      azure: {
        label: "Azure Blob Storage",
        description: "Azure Blob containers via the azure extension.",
        schema: z.object({
          url: z.string().min(1),
          readOnly: booleanish.default(false),
          connectionString: z.string().optional(),
        }),
      },
      quack: {
        label: "DuckDB server (Quack)",
        description:
          "A remote DuckDB instance served over HTTP. Reads use HTTPS by default.",
        schema: z.object({
          uri: z.string().min(1).default("quack:localhost"),
          token: z.string().optional(),
          disableSsl: booleanish.default(false),
        }),
      },
    },
  },
};

export type DuckDbConfig = {
  method?: string;
  readOnly?: boolean;
  path?: string;
  url?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3SessionToken?: string;
  s3Region?: string;
  s3Endpoint?: string;
  gcsKeyId?: string;
  gcsSecret?: string;
  r2KeyId?: string;
  r2Secret?: string;
  r2AccountId?: string;
  connectionString?: string;
  uri?: string;
  token?: string;
  disableSsl?: boolean;
};

export interface QueryResult {
  columns: string[];
  /** SQL type names aligned with columns; omitted by legacy clients. */
  columnTypes?: string[];
  rows: Record<string, unknown>[];
  rowsChanged?: number;
}

export interface DuckDbOverview {
  version: string;
  databases: number;
  tables: number;
  views: number;
  extensions: number;
}

export interface TableInfo {
  database: string;
  schema: string;
  name: string;
  type: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DatabaseInfo {
  name: string;
  path: string | null;
  internal: boolean;
  readonly: boolean;
}

export interface SchemaInfo {
  database: string;
  name: string;
}

export interface SequenceInfo {
  database: string;
  schema: string;
  name: string;
}

export interface ViewInfo {
  database: string;
  schema: string;
  name: string;
}

export interface IndexInfo {
  database: string;
  schema: string;
  name: string;
  table: string;
  sql: string;
}

export interface MacroInfo {
  database: string;
  schema: string;
  name: string;
  parameters: string;
}

export interface FunctionInfo {
  name: string;
  type: string;
  parameters: string;
  returnType: string;
  description: string;
}

export interface TypeInfo {
  name: string;
  logicalType: string;
  size: string;
}

export interface ExtensionInfo {
  name: string;
  loaded: boolean;
  installed: boolean;
  version: string;
  description: string;
}

export interface SettingInfo {
  name: string;
  value: string;
  description: string;
  inputType: string;
}

export interface SecretInfo {
  name: string;
  type: string;
  provider: string;
  scope: string;
}

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  status: "SUCCESS" | "ERROR";
  rows: number;
  elapsedMs: number;
  startedAt: string;
  message?: string;
}

export interface DuckDbClient {
  /** Abort in-flight work when the owning instance is disposed. */
  dispose(): void;
  /** Cancel the currently running statement (cooperative interrupt). */
  interrupt(): void;
  // Catalog
  getOverview(): Promise<DuckDbOverview>;
  listDatabases(): Promise<DatabaseInfo[]>;
  getDatabase(database: string): Promise<DatabaseInfo | null>;
  databaseSize(database?: string): Promise<QueryResult>;
  listSchemas(database: string): Promise<SchemaInfo[]>;
  listTables(database: string, schema: string): Promise<TableInfo[]>;
  listViews(database: string, schema: string): Promise<ViewInfo[]>;
  getColumns(
    database: string,
    schema: string,
    table: string,
  ): Promise<ColumnInfo[]>;
  previewTable(
    database: string,
    schema: string,
    table: string,
    limit?: number,
  ): Promise<QueryResult>;
  getTableDdl(database: string, schema: string, table: string): Promise<string>;
  getViewDdl(database: string, schema: string, view: string): Promise<string>;
  summarizeTable(
    database: string,
    schema: string,
    table: string,
  ): Promise<QueryResult>;
  listSequences(database: string, schema: string): Promise<SequenceInfo[]>;
  listIndexes(database: string, schema: string): Promise<IndexInfo[]>;
  listMacros(database: string, schema: string): Promise<MacroInfo[]>;
  listFunctions(search?: string): Promise<FunctionInfo[]>;
  listTypes(): Promise<TypeInfo[]>;
  // Configuration
  listExtensions(): Promise<ExtensionInfo[]>;
  installExtension(name: string, repository?: string): Promise<void>;
  loadExtension(name: string): Promise<void>;
  listSettings(search?: string): Promise<SettingInfo[]>;
  setSetting(name: string, value: string): Promise<void>;
  resetSetting(name: string): Promise<void>;
  // Secrets
  listSecrets(): Promise<SecretInfo[]>;
  createSecret(input: {
    type: string;
    keyId?: string;
    secret: string;
    region?: string;
    endpoint?: string;
    scope?: string;
  }): Promise<void>;
  dropSecret(name: string): Promise<void>;
  // Sessions / databases
  attach(input: {
    source: string;
    alias: string;
    readOnly?: boolean;
    token?: string;
  }): Promise<void>;
  detach(database: string): Promise<void>;
  // Quack server hosted on this instance
  serveQuack(input: {
    uri?: string;
    allowRemote?: boolean;
    token?: string;
  }): Promise<QueryResult>;
  stopQuack(uri: string): Promise<void>;
  // Query history
  listQueryHistory(filter?: {
    search?: string;
    status?: string | null;
  }): Promise<QueryHistoryEntry[]>;
  // Ad-hoc SQL
  execute(
    sql: string,
    options?: { signal?: AbortSignal },
  ): Promise<QueryResult>;
  version(): Promise<string>;
}

export interface DuckDbContext {
  client: DuckDbClient;
  config: DuckDbConfig;
  log(message: string, fields?: Record<string, unknown>): void;
}

export function createContext(
  client: DuckDbClient,
  config: DuckDbConfig,
): DuckDbContext {
  return {
    client,
    config,
    log: (message, fields) => {
      void message;
      void fields;
    },
  };
}
