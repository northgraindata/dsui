import type { Conversation } from "./model";

type Service = { id: string; name: string };
type ToolRun = Conversation["tools"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function textField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" && field.trim()
    ? field.slice(0, 160)
    : undefined;
}

function toolActivity(tool: ToolRun, services: readonly Service[]) {
  const args = record(tool.input);
  const serviceId = textField(args, "serviceId");
  const service =
    services.find((item) => item.id === serviceId)?.name ?? serviceId;
  const scope = service ? ` for ${service}` : "";
  switch (tool.name) {
    case "list_actions":
      return `Discovering available actions${scope}`;
    case "list_services":
      return "Finding connected services";
    case "get_service_health":
      return `Checking service health${scope}`;
    case "list_events":
      return `Reading recent events${scope}`;
    case "discover_resources":
      return `Discovering available resources${scope}`;
    case "read_resource": {
      const resourceId = textField(args, "resourceId");
      const resource = resourceId?.replace(/[-_]/g, " ") ?? "resource";
      const input = record(args.input);
      const table = textField(input, "table") ?? textField(input, "relation");
      const schema = textField(input, "schema");
      const target = table
        ? [schema, table].filter(Boolean).join(".")
        : undefined;
      return `Reading ${resource}${target ? ` for ${target}` : ""}${service ? ` from ${service}` : ""}`;
    }
    default:
      return "Working on your request";
  }
}

/** Report persisted tool activity without guessing which operation is running. */
export function activityMessage(
  tools: readonly ToolRun[],
  services: readonly Service[],
  hasText: boolean,
) {
  const running = tools.filter((tool) => tool.status === "running");
  const latest = running.at(-1);
  if (latest) {
    const activity = toolActivity(latest, services);
    return running.length > 1
      ? `${activity} · ${running.length} tasks in progress`
      : activity;
  }
  if (hasText) return "Writing your response";
  return tools.length ? "Processing results" : "Understanding your request";
}
