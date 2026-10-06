import {
  type PluginContext,
  PluginRequestError,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import type { Config } from "./model";

const serviceInput = z.object({ serviceId: z.string().min(1) });
export const toolInputSchemas = {
  list_services: z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  get_service_health: serviceInput,
  discover_resources: serviceInput,
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
    if (!(await context.services.get(id)))
      throw new PluginRequestError("Service not found", 404);
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
      const { serviceId } = serviceInput.parse(raw);
      await requireService(serviceId);
      if (!context.services.resources)
        throw new Error("Host does not support adapter resource discovery");
      return {
        serviceId,
        resources: await context.services.resources(serviceId),
      };
    }
    case "read_resource": {
      const input = toolInputSchemas.read_resource.parse(raw);
      await requireService(input.serviceId);
      if (!context.services.readResource)
        throw new Error("Host does not support adapter resource reads");
      return {
        serviceId: input.serviceId,
        resourceId: input.resourceId,
        data: await context.services.readResource(
          input.serviceId,
          input.resourceId,
          input.input ?? {},
        ),
      };
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

/** Bounded tool evidence; truncation remains explicit to the model and UI. */
export function boundOutput(
  value: unknown,
  maxCharacters = 24_000,
  secrets: readonly string[] = [],
): unknown {
  const json = JSON.stringify(value ?? null, (key, item: unknown) => {
    if (
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
