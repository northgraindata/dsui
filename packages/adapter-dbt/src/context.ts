import { z } from "@northgraindata/dsui-adapter-sdk";

const secretRefSchema = z.object({
  secretRef: z.string().min(1),
  value: z.never().optional(),
});

const secretValueSchema = z.object({
  value: z.string().min(1),
  secretRef: z.never().optional(),
});

/** A credential may be resolved by the host or supplied directly by a caller. */
export const secretInputSchema = z.union([secretRefSchema, secretValueSchema]);
export type SecretInput = z.output<typeof secretInputSchema>;

export type EnvironmentValue =
  | { readonly value: string; readonly secretRef?: never }
  | { readonly secretRef: string; readonly value?: never };

const environmentValueSchema = z.union([
  z.object({ value: z.string(), secretRef: z.never().optional() }),
  z.object({ secretRef: z.string().min(1), value: z.never().optional() }),
]);

const cloudBaseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash;
  }, "dbt Cloud URL must not contain credentials, query parameters, or fragments");

export const dbtCloudConnectionSchema = z.object({
  baseUrl: cloudBaseUrlSchema,
  accountId: z.string().min(1),
  apiToken: secretInputSchema,
});

export const dbtLocalConnectionSchema = z.object({
  projectPath: z.string().min(1),
  profilesDir: z.string().min(1).optional(),
  profile: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  executable: z.string().min(1).default("dbt"),
  targetPath: z.string().min(1).optional(),
  environment: z.record(environmentValueSchema).optional(),
  artifactBundlePath: z.string().min(1).optional(),
});

export type DbtCloudConfig = z.output<typeof dbtCloudConnectionSchema> & {
  method: "cloud";
};
export type DbtLocalConfig = z.output<typeof dbtLocalConnectionSchema> & {
  method: "local";
};
export type DbtConfig = DbtCloudConfig | DbtLocalConfig;

export const dbtConnectionMethods = {
  cloud: {
    label: "dbt Cloud",
    description: "Connect to a dbt Cloud account using its regional API URL.",
    schema: dbtCloudConnectionSchema,
  },
  local: {
    label: "dbt Local",
    description: "Connect to a project and host-managed dbt executable.",
    schema: dbtLocalConnectionSchema,
  },
} as const;

export function validateDbtConfig(rawConfig: unknown): DbtConfig {
  if (!rawConfig || typeof rawConfig !== "object")
    throw new Error("dbt connection must be an object");

  const method = (rawConfig as { method?: unknown }).method;
  if (method === "cloud")
    return { method, ...dbtCloudConnectionSchema.parse(rawConfig) };
  if (method === "local")
    return { method, ...dbtLocalConnectionSchema.parse(rawConfig) };
  throw new Error('dbt connection method must be "cloud" or "local"');
}

export interface DbtContext {
  readonly config: DbtConfig;
  readonly backend: DbtBackend;
}

export interface DbtBackend {
  readonly metadata: DbtMetadata;
  validateConnection(connection: unknown): DbtConfig;
  readiness(config: DbtConfig): DbtReadiness;
  executeAction(
    actionId: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<never>;
}

export interface DbtMetadata {
  readonly provider: "dbt";
  readonly connectionMethods: readonly ("cloud" | "local")[];
  readonly commands: readonly DbtCommandId[];
  readonly actions: readonly DbtActionId[];
  readonly resources: readonly DbtResourceId[];
}

export interface DbtReadiness {
  readonly status: "ready" | "invalid";
  readonly method: DbtConfig["method"];
  readonly detail: string;
  readonly execution: "not-implemented";
}

export const DBT_COMMAND_IDS = [
  "run",
  "build",
  "test",
  "compile",
  "docs-generate",
] as const;
export type DbtCommandId = (typeof DBT_COMMAND_IDS)[number];

export const DBT_ACTION_IDS = [
  "run",
  "build",
  "test",
  "compile",
  "docs-generate",
  "cancel",
  "retry",
] as const;
export type DbtActionId = (typeof DBT_ACTION_IDS)[number];

export const DBT_RESOURCE_IDS = [
  "metadata",
  "readiness",
  "projects",
  "runs",
  "artifacts",
  "documentation",
] as const;
export type DbtResourceId = (typeof DBT_RESOURCE_IDS)[number];

export const dbtMetadata: DbtMetadata = {
  provider: "dbt",
  connectionMethods: ["cloud", "local"],
  commands: DBT_COMMAND_IDS,
  actions: DBT_ACTION_IDS,
  resources: DBT_RESOURCE_IDS,
};

export function getDbtReadiness(config: DbtConfig): DbtReadiness {
  return {
    status: "ready",
    method: config.method,
    detail:
      config.method === "cloud"
        ? "dbt Cloud configuration is valid; provider execution is not implemented."
        : "dbt Local configuration is valid; host process execution is not implemented.",
    execution: "not-implemented",
  };
}

/** Return only connection details that are safe to expose as metadata. */
export function publicDbtConfig(config: DbtConfig): {
  method: DbtConfig["method"];
  endpoint: string;
} {
  return config.method === "cloud"
    ? { method: config.method, endpoint: new URL(config.baseUrl).origin }
    : { method: config.method, endpoint: config.projectPath };
}
