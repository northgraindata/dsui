import { createHash } from "node:crypto";
import {
  connection,
  connections,
  database,
  deleteConnection,
  writeConnection,
} from "./database";
import {
  type Connection,
  type Context,
  connectionName,
  connectionSchema,
} from "./model";
import { safePath } from "./paths";

function configuredId(key: string): string {
  const hash = createHash("sha256")
    .update(`code-repository/config/${key}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function reconcileConfiguredConnections(context: Context): void {
  const db = database(context);
  const keys = new Set(context.config.connections.map((item) => item.key));
  db.transaction(() => {
    for (const item of connections(db))
      if (item.configKey && !keys.has(item.configKey))
        deleteConnection(db, item.id);
    for (const configured of context.config.connections) {
      const input = connectionSchema.parse(configured);
      input.folder = safePath(input.folder);
      input.branch = input.provider === "local" ? "" : input.branch;
      input.name ||= connectionName(input);
      const id = configuredId(configured.key);
      const previous = connection(db, id);
      const sourceFields = [
        "serviceId",
        "provider",
        "instance",
        "repository",
        "branch",
        "folder",
      ] as const;
      const sourceChanged =
        !previous || sourceFields.some((key) => previous[key] !== input[key]);
      const changed =
        sourceChanged ||
        !previous ||
        previous.name !== input.name ||
        previous.instructions !== input.instructions;
      if (previous && !changed) {
        continue;
      }
      const item: Connection = {
        ...input,
        id,
        configKey: configured.key,
        revision: (previous?.revision ?? 0) + 1,
        status: "queued",
        error: null,
        version: sourceChanged ? null : (previous?.version ?? null),
        lastAttemptAt: null,
        lastFetchedAt: sourceChanged ? null : (previous?.lastFetchedAt ?? null),
      };
      if (sourceChanged)
        db.query("DELETE FROM files WHERE connection_id = ?").run(id);
      writeConnection(db, item);
    }
  })();
}
