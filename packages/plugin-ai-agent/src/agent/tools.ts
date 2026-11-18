import {
  type PluginContext,
  PluginRequestError,
  type PluginServiceResource,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import type { Config } from "./model";
import { resourceNavigation } from "./resource-navigation";
import { listSkills, readSkill } from "./skills";

const serviceInput = z.object({ serviceId: z.string().min(1) });
const discoveryInput = serviceInput.extend({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
const resourceReadInput = serviceInput.extend({
  resourceId: z.string().min(1),
  input: z.unknown().default({}),
});
export const toolInputSchemas = {
  list_skills: z.object({}),
  read_skill: z.object({ id: z.string().min(1) }),
  list_plugins: z.object({}),
  list_services: z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  search_workspace_resources: z.object({
    query: z.string().trim().min(1).max(100),
    serviceIds: z.array(z.string().min(1)).min(1).max(10).optional(),
    cursor: z.string().optional(),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  get_service_health: serviceInput,
  list_resources: discoveryInput,
  list_actions: discoveryInput,
  query_resource: resourceReadInput,
  execute_action: serviceInput.extend({
    actionId: z.string().min(1),
    input: z.unknown().default({}),
  }),
  list_plugin_resources: z.object({ pluginId: z.string().min(1) }),
  query_plugin_resource: z.object({
    pluginId: z.string().min(1),
    resourceId: z.string().min(1),
    input: z.unknown().default({}),
  }),
  list_plugin_actions: z.object({ pluginId: z.string().min(1) }),
  execute_plugin_action: z.object({
    pluginId: z.string().min(1),
    actionId: z.string().min(1),
    input: z.unknown().default({}),
  }),
  read_resources_batch: z.object({
    requests: z.array(resourceReadInput).min(1).max(5),
  }),
  list_events: z.object({
    serviceId: z.string().optional(),
    signalId: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
};
/** Cancel delivery without pretending the SDK can forcibly terminate a provider read. */
export function withAbortSignal<T>(
  signal: AbortSignal,
  operation: Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Tool cancelled"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    void operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export async function executeTool(
  context: PluginContext<Config>,
  serviceIds: readonly string[],
  name: string,
  raw: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const requireService = async (id: string) => {
    await context.access.require(id, "inspect");
    const service = await context.services.get(id);
    if (!service) throw new PluginRequestError("Service not found", 404);
    return service;
  };
  switch (name) {
    case "list_skills":
      toolInputSchemas.list_skills.parse(raw);
      return { skills: listSkills() };
    case "read_skill": {
      const { id } = toolInputSchemas.read_skill.parse(raw);
      const skill = readSkill(id);
      if (!skill) throw new PluginRequestError("Unknown agent skill", 404);
      return skill;
    }
    case "list_services": {
      const input = toolInputSchemas.list_services.parse(raw);
      const page = await context.services.list(input);
      return page;
    }
    case "list_plugins":
      toolInputSchemas.list_plugins.parse(raw);
      return { plugins: await context.plugins.list() };
    case "search_workspace_resources": {
      const input = toolInputSchemas.search_workspace_resources.parse(raw);
      const page = input.serviceIds
        ? {
            items: await Promise.all(input.serviceIds.map(requireService)),
            nextCursor: undefined,
          }
        : await context.services.list({ cursor: input.cursor, limit: 25 });
      const query = input.query.toLowerCase();
      const visibleServices = page.items.filter(() => true);
      const discovered = await Promise.all(
        visibleServices.map(async (service) => {
          const resources =
            (await context.services.listResources(service.id)) ?? [];
          return resources
            .filter((resource) =>
              [resource.id, resource.description ?? "", service.name]
                .join(" ")
                .toLowerCase()
                .includes(query),
            )
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((resource) => ({
              serviceId: service.id,
              serviceName: service.name,
              resourceId: resource.id,
              description: resource.description,
            }));
        }),
      );
      const matches = discovered.flat();
      const items = matches.slice(input.offset, input.offset + input.limit);
      return {
        items,
        nextOffset:
          input.offset + input.limit < matches.length
            ? input.offset + input.limit
            : undefined,
        nextCursor:
          input.offset + input.limit >= matches.length
            ? page.nextCursor
            : undefined,
        scannedServices: visibleServices.length,
      };
    }
    case "get_service_health": {
      const { serviceId } = serviceInput.parse(raw);
      await requireService(serviceId);
      return context.services.probe(serviceId, { timeoutMs: 5000 });
    }
    case "list_resources": {
      const { serviceId, cursor, limit } = discoveryInput.parse(raw);
      await requireService(serviceId);
      const page = discoveryPage(
        (await context.services.listResources(serviceId)) ?? [],
        cursor,
        limit,
      );
      return {
        serviceId,
        nextCursor: page.nextCursor,
        resources: page.items,
      };
    }
    case "list_actions": {
      const { serviceId, cursor, limit } = discoveryInput.parse(raw);
      await requireService(serviceId);
      const page = discoveryPage(
        (await context.services.listActions(serviceId)) ?? [],
        cursor,
        limit,
      );
      return {
        serviceId,
        nextCursor: page.nextCursor,
        actions: page.items,
      };
    }
    case "query_resource": {
      const input = toolInputSchemas.query_resource.parse(raw);
      await requireService(input.serviceId);
      return readResource(context, input);
    }
    case "execute_action": {
      const input = toolInputSchemas.execute_action.parse(raw);
      await context.access.require(input.serviceId, "execute");
      const result = await context.services.executeAction(
        input.serviceId,
        input.actionId,
        input.input,
        signal ? { signal } : undefined,
      );
      return { serviceId: input.serviceId, actionId: input.actionId, result };
    }
    case "list_plugin_resources": {
      const { pluginId } = toolInputSchemas.list_plugin_resources.parse(raw);
      const resources = await context.plugins.listResources(pluginId);
      if (!resources)
        throw new PluginRequestError("Plugin not found or access denied", 404);
      return { pluginId, resources };
    }
    case "query_plugin_resource": {
      const input = toolInputSchemas.query_plugin_resource.parse(raw);
      return {
        pluginId: input.pluginId,
        resourceId: input.resourceId,
        data: await context.plugins.queryResource(
          input.pluginId,
          input.resourceId,
          input.input,
        ),
      };
    }
    case "list_plugin_actions": {
      const { pluginId } = toolInputSchemas.list_plugin_actions.parse(raw);
      const actions = await context.plugins.listActions(pluginId);
      if (!actions)
        throw new PluginRequestError("Plugin not found or access denied", 404);
      return { pluginId, actions };
    }
    case "execute_plugin_action": {
      const input = toolInputSchemas.execute_plugin_action.parse(raw);
      return {
        pluginId: input.pluginId,
        actionId: input.actionId,
        result: await context.plugins.executeAction(
          input.pluginId,
          input.actionId,
          input.input,
          signal ? { signal } : undefined,
        ),
      };
    }
    case "read_resources_batch": {
      const { requests } = toolInputSchemas.read_resources_batch.parse(raw);
      const items = await Promise.all(
        requests.map(async (request) => {
          try {
            await requireService(request.serviceId);
            const output = await readResource(context, request);
            return {
              serviceId: request.serviceId,
              resourceId: request.resourceId,
              status: "completed" as const,
              output: boundOutput(
                output,
                4_000,
                [],
                context.config.sensitiveColumns,
              ),
            };
          } catch (cause) {
            return {
              serviceId: request.serviceId,
              resourceId: request.resourceId,
              status: "error" as const,
              error:
                cause instanceof PluginRequestError
                  ? cause.message
                  : "Resource unavailable or access denied",
            };
          }
        }),
      );
      return { items };
    }
    case "list_events": {
      const input = toolInputSchemas.list_events.parse(raw);
      if (input.serviceId) await requireService(input.serviceId);
      if (!context.events.read)
        throw new Error("Host does not support persisted event reads");
      const page = await context.events.read({
        cursor: input.cursor,
        limit: input.limit,
      });
      return {
        ...page,
        items: page.items.filter(
          (event) =>
            (!input.serviceId || event.serviceId === input.serviceId) &&
            (!input.signalId || event.signalId === input.signalId) &&
            (!serviceIds.length ||
              Boolean(event.serviceId && serviceIds.includes(event.serviceId))),
        ),
      };
    }
    default:
      throw new PluginRequestError("Unknown agent tool", 422);
  }
}

async function readResource(
  context: PluginContext<Config>,
  input: z.output<typeof toolInputSchemas.query_resource>,
) {
  const resource = (
    await context.services.listResources(input.serviceId)
  )?.find((item) => item.id === input.resourceId);
  if (!resource)
    throw new PluginRequestError("Unknown resource for this service", 422);
  const data = await context.services.queryResource(
    input.serviceId,
    input.resourceId,
    input.input,
  );
  const navigation = resourceNavigation(input.serviceId, data);
  return {
    serviceId: input.serviceId,
    resourceId: input.resourceId,
    ...(navigation.length ? { navigation } : {}),
    data,
  };
}

function discoveryPage<T extends { readonly id: string }>(
  entries: readonly T[],
  cursor: string | undefined,
  limit: number,
) {
  const remaining = [...entries]
    .sort((left, right) => {
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    })
    .filter((entry) => !cursor || entry.id > cursor);
  const items = remaining.slice(0, limit);
  return {
    items,
    nextCursor: remaining.length > limit ? items.at(-1)?.id : undefined,
  };
}

/** Bounded tool evidence; truncation remains explicit to the model and UI. */
export function boundOutput(
  value: unknown,
  maxCharacters = 24_000,
  secrets: readonly string[] = [],
  sensitiveColumns: readonly string[] = [],
): unknown {
  const json = JSON.stringify(value ?? null, (key, item: unknown) => {
    if (
      sensitiveColumns.some(
        (column) => column.toLowerCase() === key.toLowerCase(),
      ) ||
      /^(?:password|passwd|secret|token|api[_-]?key|authorization|credentials?|private[_-]?key|access[_-]?token|refresh[_-]?token)$/i.test(
        key,
      )
    )
      return "[REDACTED]";
    if (typeof item !== "string") return item;
    let text = item;
    for (const secret of secrets)
      if (secret) text = text.split(secret).join("[REDACTED]");
    return text;
  });
  return json.length <= maxCharacters
    ? JSON.parse(json)
    : {
        truncated: true,
        totalCharacters: json.length,
        preview: json.slice(0, maxCharacters),
      };
}
