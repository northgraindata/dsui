import { randomUUID } from "node:crypto";
import {
  defineComponent,
  defineJob,
  definePage,
  definePlugin,
  defineResource,
  defineSlot,
  Link,
  PluginRequestError,
  type PluginServiceSummary,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import {
  connection,
  connections,
  database,
  deleteConnection,
  listFiles,
  publishSnapshot,
  readFile,
  writeConnection,
} from "./database";
import {
  type Connection,
  type Context,
  configSchema,
  connectionSchema,
  fileRequestSchema,
  locatorSchema,
  previewLimit,
  route,
} from "./model";
import { safePath } from "./paths";
import { branches, fetchSnapshot, localDirectory } from "./providers";

async function requireService(
  context: Context,
  id: string,
  permission: "inspect" | "execute" | "manage",
) {
  await context.access.require(id, permission);
  if (!(await context.services.get(id)))
    throw new PluginRequestError("Service not found", 404);
}
async function requireConnection(
  context: Context,
  input: z.infer<typeof locatorSchema>,
  permission: "inspect" | "execute" | "manage",
) {
  await requireService(context, input.serviceId, permission);
  const item = connection(database(context), input.connectionId);
  if (!item || item.serviceId !== input.serviceId)
    throw new PluginRequestError("Connection not found", 404);
  return item;
}
export async function syncConnection(
  context: Context,
  id: string,
  signal: AbortSignal,
) {
  const db = database(context);
  const item = connection(db, id);
  if (!item) return;
  const service = await context.services.get(item.serviceId);
  if (connection(db, id)?.revision !== item.revision) return;
  if (!service) {
    writeConnection(db, {
      ...item,
      status: "error",
      error: "Service no longer exists",
      lastAttemptAt: new Date().toISOString(),
    });
    return;
  }
  const attempted = {
    ...item,
    status: "syncing" as const,
    lastAttemptAt: new Date().toISOString(),
    error: null,
  };
  writeConnection(db, attempted);
  try {
    const snapshot = await fetchSnapshot(context.config, item, signal);
    signal.throwIfAborted();
    const current = connection(db, id);
    if (!current || current.revision !== item.revision) return;
    const next = {
      ...attempted,
      status: "ready" as const,
      lastFetchedAt: new Date().toISOString(),
      version: snapshot.version,
    };
    if (snapshot.version !== item.version) {
      publishSnapshot(db, next, snapshot.files);
      await context.events.emit(
        "updated",
        {
          connectionId: id,
          serviceId: item.serviceId,
          version: snapshot.version,
        },
        item.serviceId,
      );
    } else writeConnection(db, next);
  } catch (error) {
    const current = connection(db, id);
    if (current?.revision === item.revision)
      writeConnection(db, {
        ...current,
        status: "error",
        error:
          error instanceof Error ? error.message : "Repository sync failed",
      });
    throw error;
  }
}
export const overview = defineResource({
  id: "overview",
  input: z.object({ serviceId: z.string().optional() }),
  refresh: poll("5s"),
  query: async (input, context: Context) => {
    const services: PluginServiceSummary[] = [];
    let cursor: string | undefined;
    do {
      const page = await context.services.list({ cursor, limit: 100 });
      services.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    const visible = input.serviceId
      ? services.filter((service) => service.id === input.serviceId)
      : services;
    const items = connections(database(context));
    return {
      services: visible.map((service) => ({
        ...service,
        connections: items.filter((item) => item.serviceId === service.id),
      })),
      providers: {
        github: true,
        gitlab: context.config.gitlab.map(({ id, url }) => ({ id, url })),
        local: context.config.localRoots.length > 0,
      },
    };
  },
});
const fileTree = defineResource({
  id: "tree",
  input: locatorSchema,
  refresh: poll("5s"),
  query: async (input, context: Context) => {
    const item = await requireConnection(context, input, "inspect");
    return { connection: item, files: listFiles(database(context), item.id) };
  },
});
const fileContents = defineResource({
  id: "file",
  input: fileRequestSchema,
  query: async (input, context: Context) => {
    const item = await requireConnection(context, input, "inspect");
    const path = safePath(input.path);
    const file = readFile(database(context), item.id, path);
    if (!file) throw new PluginRequestError("File not found", 404);
    const oversized = file.size > previewLimit;
    let content: string | null = null;
    if (!oversized && !file.bytes.includes(0)) {
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
      } catch {
        /* Binary files have metadata only. */
      }
    }
    return {
      path,
      size: file.size,
      content,
      reason: oversized
        ? "File exceeds the 1 MiB preview limit"
        : content === null
          ? "Binary file"
          : null,
      version: item.version,
    };
  },
});
const Screen = defineComponent<{
  serviceId?: string;
  connectionId?: string;
  path?: string;
}>({ id: "code-repository/screen", path: "./browser.tsx" });
export function createCodeRepositoryPlugin() {
  return definePlugin({
    metadata: {
      id: "code-repository",
      name: "Code repositories",
      version: "0.1.0",
      apiVersion: 1,
    },
    configSchema,
    setup(registry) {
      registry.signal({
        id: "updated",
        type: "success",
        payload: z.object({
          connectionId: z.string().uuid(),
          serviceId: z.string(),
          version: z.string(),
        }),
      });
      registry.resource(overview);
      registry.resource(fileTree);
      registry.resource(fileContents);
      registry.page(
        definePage({ path: "/overview", render: () => Screen({}) }),
        {
          id: "overview",
          title: "Code repositories",
          description: "Connect code to your services.",
        },
      );
      registry.page(
        definePage({
          path: "/services/:serviceId",
          render: ({ params }) => Screen({ serviceId: params.serviceId }),
        }),
        { id: "settings", title: "Repository settings" },
      );
      registry.page(
        definePage({
          path: "/services/:serviceId/connections/:connectionId/files/*path",
          render: ({ params }) =>
            Screen({
              serviceId: params.serviceId,
              connectionId: params.connectionId,
              path: params.path,
            }),
        }),
        { id: "files", title: "Code explorer" },
      );
      registry.navigation({
        id: "repositories",
        area: "primary",
        label: "Code repositories",
        pageId: "overview",
        order: 70,
      });
      registry.slot(
        defineSlot<Context, PluginServiceSummary>({
          id: "service-code",
          slot: "service.workspace.after-header",
          render: ({ service }) =>
            Link({ label: "Code repositories", href: route(service.id) }),
        }),
      );
      registry.procedure({
        id: "branches",
        permission: "manage",
        input: connectionSchema.pick({
          serviceId: true,
          provider: true,
          instance: true,
          repository: true,
        }),
        handler: async (context, input) => {
          await requireService(context, input.serviceId, "manage");
          if (input.provider === "local") return [];
          return branches(
            context.config,
            { ...input, instance: input.instance ?? "gitlab" },
            AbortSignal.timeout(30000),
          );
        },
      });
      registry.procedure({
        id: "folders",
        permission: "manage",
        input: connectionSchema.pick({
          serviceId: true,
          provider: true,
          instance: true,
          repository: true,
          branch: true,
        }),
        handler: async (context, rawInput) => {
          const input = connectionSchema.parse({
            ...rawInput,
            name: "Folder preview",
            refreshMinutes: 0,
          });
          await requireService(context, input.serviceId, "manage");
          if (input.provider !== "local" && !input.branch)
            throw new PluginRequestError("Select a branch");
          const snapshot = await fetchSnapshot(
            context.config,
            {
              ...input,
              folder: "",
              id: randomUUID(),
              revision: 0,
              version: null,
              status: "idle",
              lastAttemptAt: null,
              lastFetchedAt: null,
              error: null,
            },
            AbortSignal.timeout(60000),
          );
          const folders = new Set<string>();
          for (const file of snapshot.files) {
            const parts = file.path.split("/");
            for (let index = 1; index < parts.length; index++)
              folders.add(parts.slice(0, index).join("/"));
          }
          return [...folders].sort();
        },
      });
      registry.procedure({
        id: "save",
        permission: "manage",
        input: connectionSchema,
        handler: async (context, rawInput) => {
          const input = connectionSchema.parse(rawInput);
          await requireService(context, input.serviceId, "manage");
          const db = database(context);
          const previous = input.id
            ? await requireConnection(
                context,
                { serviceId: input.serviceId, connectionId: input.id },
                "manage",
              )
            : null;
          const folder = safePath(input.folder);
          if (input.provider === "local")
            await localDirectory(context.config, { ...input, folder });
          else {
            if (!input.branch) throw new PluginRequestError("Select a branch");
            const available = await branches(
              context.config,
              input,
              AbortSignal.timeout(30000),
            );
            if (!available.includes(input.branch))
              throw new PluginRequestError("Branch not found");
          }
          if (
            previous &&
            connection(db, previous.id)?.revision !== previous.revision
          )
            throw new PluginRequestError(
              "Connection changed while saving; reload its settings",
              409,
            );
          const sourceChanged =
            previous &&
            (previous.provider !== input.provider ||
              previous.repository !== input.repository ||
              previous.instance !== input.instance ||
              previous.folder !== folder ||
              previous.branch !== input.branch);
          const item: Connection = {
            ...input,
            folder,
            branch: input.provider === "local" ? "" : input.branch,
            id: previous?.id ?? randomUUID(),
            revision: (previous?.revision ?? 0) + 1,
            status: "queued",
            lastAttemptAt: previous?.lastAttemptAt ?? null,
            lastFetchedAt: previous?.lastFetchedAt ?? null,
            error: null,
            version: sourceChanged ? null : (previous?.version ?? null),
          };
          db.transaction(() => {
            writeConnection(db, item);
            if (sourceChanged)
              db.query("DELETE FROM files WHERE connection_id = ?").run(
                item.id,
              );
          })();
          try {
            await context.jobs.enqueue("sync", {
              connectionId: item.id,
              revision: item.revision,
            });
          } catch (error) {
            writeConnection(db, {
              ...item,
              status: "error",
              error: "Could not queue repository refresh",
            });
            throw error;
          }
          return item;
        },
      });
      registry.procedure({
        id: "remove",
        permission: "manage",
        input: locatorSchema,
        handler: async (context, input) => {
          const item = await requireConnection(context, input, "manage");
          deleteConnection(database(context), item.id);
          return { removed: true };
        },
      });
      registry.procedure({
        id: "refresh",
        permission: "execute",
        input: locatorSchema,
        handler: async (context, input) => {
          const item = await requireConnection(context, input, "execute");
          const result = await context.jobs.enqueue("sync", {
            connectionId: item.id,
            revision: item.revision,
          });
          writeConnection(database(context), {
            ...item,
            status: "queued",
            error: null,
          });
          return result;
        },
      });
      registry.job(
        defineJob({
          id: "sync",
          inputSchema: z.object({
            connectionId: z.string().uuid(),
            revision: z.number().int(),
          }),
          concurrency: "per-key",
          timeoutMs: 300000,
          retry: { maxAttempts: 3, backoffMs: 5000 },
          run: async ({ input, context }) => {
            const parsed = z
              .object({ connectionId: z.string(), revision: z.number() })
              .parse(input);
            const ctx: Context = {
              ...context,
              config: configSchema.parse(context.config),
            };
            if (
              connection(database(ctx), parsed.connectionId)?.revision ===
              parsed.revision
            )
              await syncConnection(ctx, parsed.connectionId, context.signal);
          },
        }),
      );
      registry.job(
        defineJob({
          id: "schedule-refresh",
          intervalMs: 60000,
          timeoutMs: 30000,
          run: async ({ context }) => {
            const ctx: Context = {
              ...context,
              config: configSchema.parse(context.config),
            };
            for (const item of connections(database(ctx))) {
              if (
                !item.refreshMinutes ||
                (item.lastAttemptAt &&
                  Date.now() - Date.parse(item.lastAttemptAt) <
                    item.refreshMinutes * 60000)
              )
                continue;
              await context.jobs.enqueue("sync", {
                connectionId: item.id,
                revision: item.revision,
              });
            }
          },
        }),
      );
    },
  });
}
export default createCodeRepositoryPlugin();
