import { z } from "@northgraindata/dsui-adapter-sdk";
import { createDbtCloudClient, type DbtCloudClient } from "./client.js";
import { createDbtLocalClient, type DbtLocalClient } from "./local.js";

const dbtCloudSchema = z.object({
  baseUrl: z.string().url(),
  accountId: z.string().min(1),
  apiToken: z.string().min(1),
  jobId: z.string().min(1).optional(),
});

const dbtLocalSchema = z.object({
  projectPath: z.string().min(1),
  profilesDir: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  targetPath: z.string().min(1).optional(),
  executable: z.string().min(1).default("dbt"),
});

export const dbtConnectionMethods = {
  cloud: {
    label: "dbt Cloud",
    description: "Connect to a dbt Cloud account with an API token.",
    schema: dbtCloudSchema,
  },
  local: {
    label: "dbt Local",
    description: "Connect to a dbt Core or Fusion project on the DSUI host.",
    schema: dbtLocalSchema,
  },
} as const;

export type DbtCloudConfig = z.output<typeof dbtCloudSchema> & {
  method: "cloud";
};
export type DbtLocalConfig = z.output<typeof dbtLocalSchema> & {
  method: "local";
};
export type DbtConfig = DbtCloudConfig | DbtLocalConfig;

export interface DbtContext {
  readonly config: DbtConfig;
  readonly cloud?: DbtCloudClient;
  readonly local?: DbtLocalClient;
}

export async function createContext(config: DbtConfig): Promise<DbtContext> {
  if (config.method === "cloud") {
    const cloud = createDbtCloudClient(config);
    await cloud.getAccount();
    return { config, cloud };
  }
  const local = createDbtLocalClient(config);
  await local.version();
  return { config, local };
}
