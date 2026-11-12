import { z } from "@northgraindata/dsui-adapter-sdk";

export const shaperConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("shaperkey."), {
      message: "Shaper API keys start with shaperkey.",
    }),
  /**
   * Optional Shaper user. Shaper only lets signed-in users change a
   * dashboard's visibility and share password, never an API key, so sharing
   * needs both of these. Connection schemas must be plain objects, so the
   * pair is checked where it is used.
   */
  userEmail: z.string().trim().min(1).optional(),
  userPassword: z.string().min(1).optional(),
});

export type ShaperHttpConfig = z.output<typeof shaperConnectionSchema>;
export type ShaperConfig = { method: "api" } & ShaperHttpConfig;

/** What the server reports about itself; drives which features are offered. */
export interface ShaperSystemConfig {
  loginRequired: boolean;
  tasksEnabled: boolean;
  editEnabled: boolean;
  apiKeysEnabled: boolean;
  ingestEnabled: boolean;
  publicSharingEnabled: boolean;
  passwordProtectedSharingEnabled: boolean;
}

export type ShaperAppType = "dashboard" | "task" | "_folder";
export type ShaperVisibility = "private" | "public" | "password-protected";

export interface ShaperTaskInfo {
  lastRunAt?: string;
  lastRunSuccess?: boolean;
  /** Milliseconds. */
  lastRunDuration?: number;
  nextRunAt?: string;
  nextRunType?: string;
}

export interface ShaperApp {
  id: string;
  type: ShaperAppType;
  /** Folder path such as `/sales/`; the root is `/`. */
  path: string;
  name: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  visibility?: ShaperVisibility;
  taskInfo?: ShaperTaskInfo;
}

export interface ShaperColumn {
  name: string;
  type: string;
  nullable: boolean;
  tag: string;
}

export interface ShaperQueryResult {
  render: {
    type: string;
    label?: string | null;
    subtitle?: string | null;
    class?: string | null;
    gaugeCategories?: unknown;
    markLines?: unknown;
  };
  columns: ShaperColumn[];
  rows: unknown[][];
}

export interface ShaperSection {
  title: string | null;
  subtitle?: string | null;
  type: string;
  queries: ShaperQueryResult[];
}

/** A dashboard evaluated by the server, ready for presentation. */
export interface ShaperDashboard {
  name: string;
  visibility?: ShaperVisibility;
  sections: ShaperSection[];
  /** Milliseconds since the epoch when the data should be reloaded. */
  reloadAt?: number;
  unsetVariables?: string[];
}

export interface ShaperSchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  comment?: string;
}

export interface ShaperSchemaRelation {
  name: string;
  kind: "table" | "view";
  comment?: string;
  columns: ShaperSchemaColumn[];
  definition?: string;
}

export interface ShaperSchemaNamespace {
  name: string;
  relations: ShaperSchemaRelation[];
  enums: { name: string; values: string[] }[];
}

export interface ShaperDatabase {
  name: string;
  schemas: ShaperSchemaNamespace[];
}

export interface ShaperSqlResult {
  columns: string[];
  rows: string[][];
  truncated: boolean;
}

export type ShaperDeployOperation =
  | {
      operation: "create";
      type: "dashboard" | "task";
      data: { path: string; name: string; content: string; id?: string };
    }
  | {
      operation: "update";
      type: "dashboard" | "task";
      data: { id: string; path?: string; name?: string; content?: string };
    }
  | { operation: "delete"; type: "dashboard" | "task"; data: { id: string } };

export interface ShaperShareInput {
  visibility: ShaperVisibility;
  /** Required when the visibility is password-protected. */
  password?: string;
}

export interface ShaperDeployResult {
  operation: string;
  type: string;
  id?: string;
  status: string;
}

export interface ShaperClient {
  dispose(): void;
  health(signal?: AbortSignal): Promise<void>;
  getSystemConfig(signal?: AbortSignal): Promise<ShaperSystemConfig>;
  listApps(signal?: AbortSignal): Promise<ShaperApp[]>;
  getSchema(signal?: AbortSignal): Promise<ShaperDatabase[]>;
  runSql(sql: string, signal?: AbortSignal): Promise<ShaperSqlResult>;
  validateDashboard(
    sql: string,
    signal?: AbortSignal,
  ): Promise<{ valid: boolean; duration: number; error?: string }>;
  deploy(
    operations: readonly ShaperDeployOperation[],
    signal?: AbortSignal,
  ): Promise<ShaperDeployResult[]>;
  getDashboard(
    id: string,
    variables: Record<string, string | string[]>,
    signal?: AbortSignal,
  ): Promise<ShaperDashboard>;
  /** Whether DSUI holds a Shaper user login, which sharing needs. */
  canShare: boolean;
  /** Sets a dashboard's visibility and share password as the configured user. */
  shareDashboard(
    id: string,
    input: ShaperShareInput,
    signal?: AbortSignal,
  ): Promise<void>;
  /** Returns a one-time, unauthenticated download URL for a dashboard file. */
  requestDownloadUrl(
    id: string,
    filename: string,
    signal?: AbortSignal,
  ): Promise<string>;
}

export interface ShaperContext {
  client: ShaperClient;
  config: ShaperConfig;
}

export function createContext(
  client: ShaperClient,
  config: ShaperConfig,
): ShaperContext {
  return { client, config };
}
