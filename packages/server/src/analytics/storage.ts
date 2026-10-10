import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { parse, stringify } from "yaml";
import {
  type AnalyticsDashboard,
  type AnalyticsModule,
  dashboardSchema,
  moduleSchema,
} from "./definitions.js";

export class AnalyticsStore {
  private readonly root: string;

  constructor(dataDir: string) {
    this.root = join(dataDir, "analytics");
  }

  private modulePath(name: string, subfolder?: string) {
    return join(
      this.root,
      "modules",
      ...(subfolder?.split("/") ?? []),
      `${name}.yaml`,
    );
  }

  private dashboardPath(name: string) {
    return join(this.root, "dashboards", `${name}.yaml`);
  }

  private async resolveSqlFile(
    value: AnalyticsModule,
  ): Promise<AnalyticsModule> {
    if (!value.source.sqlFile) return value;
    const root = join(this.root, "queries");
    const path = join(root, value.source.sqlFile);
    const [realRoot, realFile] = await Promise.all([
      realpath(root),
      realpath(path),
    ]);
    const withinRoot = relative(realRoot, realFile);
    if (withinRoot.startsWith("..") || isAbsolute(withinRoot))
      throw new Error(
        `SQL file is outside analytics/queries: ${value.source.sqlFile}`,
      );
    const sql = (await readFile(realFile, "utf8")).trim();
    if (!sql || sql.length > 20_000)
      throw new Error(
        `SQL file must contain 1–20,000 characters: ${value.source.sqlFile}`,
      );
    return {
      ...value,
      source: {
        ...value.source,
        input: { ...value.source.input, sql },
      },
    };
  }

  async modules(): Promise<Array<AnalyticsModule & { revision: string }>> {
    const root = join(this.root, "modules");
    const result: Array<AnalyticsModule & { revision: string }> = [];
    const visit = async (folder: string): Promise<void> => {
      for (const entry of await readdir(folder, { withFileTypes: true }).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return [];
          throw error;
        },
      )) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile() && entry.name.endsWith(".yaml")) {
          const content = await readFile(path, "utf8");
          result.push({
            ...(await this.resolveSqlFile(moduleSchema.parse(parse(content)))),
            revision: revision(content),
          });
        }
      }
    };
    await visit(root);
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }

  async dashboards(): Promise<
    Array<AnalyticsDashboard & { revision: string }>
  > {
    const folder = join(this.root, "dashboards");
    const entries = await readdir(folder, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
    const result = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
        .map(async (entry) => {
          const content = await readFile(join(folder, entry.name), "utf8");
          return {
            ...dashboardSchema.parse(parse(content)),
            revision: revision(content),
          };
        }),
    );
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }

  async saveModule(raw: unknown, expectedRevision: string | null) {
    const value = moduleSchema.parse(raw);
    await this.resolveSqlFile(value);
    const path = this.modulePath(value.name, value.subfolder);
    await save(path, value, expectedRevision);
    return { ...value, revision: revision(stringify(value)) };
  }

  async saveDashboard(raw: unknown, expectedRevision: string | null) {
    const value = dashboardSchema.parse(raw);
    const references = value.modules.map(
      (item) => `${item.subfolder ?? ""}/${item.module}`,
    );
    if (new Set(references).size !== references.length)
      throw new Error("A module can appear only once per dashboard");
    const available = new Set(
      (await this.modules()).map(
        (module) => `${module.subfolder ?? ""}/${module.name}`,
      ),
    );
    for (const item of value.modules) {
      if (!available.has(`${item.subfolder ?? ""}/${item.module}`))
        throw new Error(
          `Unknown module: ${item.subfolder ? `${item.subfolder}/` : ""}${item.module}`,
        );
    }
    const path = this.dashboardPath(value.name);
    await save(path, value, expectedRevision);
    return { ...value, revision: revision(stringify(value)) };
  }
}

function revision(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function save(
  path: string,
  value: unknown,
  expectedRevision: string | null,
) {
  const existing = await readFile(path, "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    },
  );
  if ((existing === null ? null : revision(existing)) !== expectedRevision)
    throw new Error("Definition changed on disk. Reload before saving.");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringify(value), { flag: "w" });
}
