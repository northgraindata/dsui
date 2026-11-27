import { isAbsolute } from "node:path";
import { z } from "zod";

const absolutePath = z
  .string()
  .refine(isAbsolute, "Must be an absolute path on the DSUI host");

const projectSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    name: z.string().min(1),
    path: absolutePath,
  })
  .strict();

export const configSchema = z
  .object({
    /** The installed `dex` executable. Never looked up on `PATH`. */
    executable: absolutePath,
    /** The only directories Dex may run in. Each needs `.dex/config.yml`. */
    projects: z
      .array(projectSchema)
      .default([])
      .refine(
        (projects) =>
          new Set(projects.map((project) => project.id)).size ===
          projects.length,
        "Project ids must be unique",
      ),
    /** Extra host environment variables Dex receives, such as warehouse secrets. */
    passEnv: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).default([]),
    commandTimeoutMs: z.number().int().min(1_000).max(600_000).default(120_000),
  })
  .strict();

export type DexConfig = z.output<typeof configSchema>;
export type DexProject = DexConfig["projects"][number];
