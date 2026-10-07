import {
  type PluginContext,
  PluginRequestError,
  type PluginServiceResource,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import type { Config } from "./model";
import { resourceNavigation } from "./resource-navigation";

const serviceInput = z.object({ serviceId: z.string().min(1) });
const discoveryInput = serviceInput.extend({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export const toolInputSchemas = {
  list_services: z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  get_service_health: serviceInput,
  discover_resources: discoveryInput,
  list_actions: discoveryInput,
  read_resource: serviceInput.extend({
    resourceId: z.string().min(1),
    input: z.record(z.unknown()).default({}),
  }),
  list_events: z.object({
    serviceId: z.string().optional(),
    signalId: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
};
/** Cancel delivery without pretending the SDK can forcibly terminate an adapter read. */
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
): Promise<unknown> {
  const requireService = async (id: string) => {
    if (serviceIds.length && !serviceIds.includes(id))
      throw new PluginRequestError(
        "Service is outside this conversation's context",
        403,
      );
    await context.access.require(id, "inspect");
    const service = await context.services.get(id);
    if (!service) throw new PluginRequestError("Service not found", 404);
    return service;
  };
  switch (name) {
    case "list_services": {
      const input = toolInputSchemas.list_services.parse(raw);
      const page = await context.services.list(input);
      return {
        ...page,
        items: page.items.filter(
          (service) => !serviceIds.length || serviceIds.includes(service.id),
        ),
      };
    }
    case "get_service_health": {
      const { serviceId } = serviceInput.parse(raw);
      await requireService(serviceId);
      return context.services.probe(serviceId, { timeoutMs: 5000 });
    }
    case "discover_resources": {
      const { serviceId, cursor, limit } = discoveryInput.parse(raw);
      await requireService(serviceId);
      if (!context.services.resources)
        throw new Error("Host does not support adapter resource discovery");
      const page = discoveryPage(
        (await context.services.resources(serviceId)) ?? [],
        cursor,
        limit,
      );
      return {
        serviceId,
        nextCursor: page.nextCursor,
        resources: page.items.map((resource) => ({
          ...resource,
          available: resourceAllowed(resource, context.config),
        })),
      };
    }
    case "list_actions": {
      const { serviceId, cursor, limit } = discoveryInput.parse(raw);
      await requireService(serviceId);
      if (!context.services.actions)
        throw new PluginRequestError(
          "Host does not support action discovery",
          422,
        );
      const page = discoveryPage(
        (await context.services.actions(serviceId)) ?? [],
        cursor,
        limit,
      );
      return {
        serviceId,
        nextCursor: page.nextCursor,
        executionEnabled: false,
        actions: page.items,
      };
    }
    case "read_resource": {
      const input = toolInputSchemas.read_resource.parse(raw);
      await requireService(input.serviceId);
      return readResource(context, input);
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
  input: z.output<typeof toolInputSchemas.read_resource>,
) {
  if (!context.services.resources)
    throw new PluginRequestError(
      "Host does not support resource discovery",
      422,
    );
  const resource = (await context.services.resources(input.serviceId))?.find(
    (item) => item.id === input.resourceId,
  );
  if (!resource)
    throw new PluginRequestError("Unknown resource for this service", 422);
  if (!resourceAllowed(resource, context.config))
    throw new PluginRequestError(
      `Resources with policy ${resource.policy} are disabled in the AI agent configuration`,
      422,
    );
  if (!context.services.readResource)
    throw new Error("Host does not support adapter resource reads");
  const data = await context.services.readResource(
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

function resourceAllowed(resource: PluginServiceResource, config: Config) {
  if (resource.policy === "sql") return config.allowReadOnlySql;
  if (resource.policy === "preview") return config.allowTablePreview;
  return true;
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
