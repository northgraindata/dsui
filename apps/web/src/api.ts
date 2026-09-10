import type {
  HealthStatus,
  PageDocument,
  PublicAdapter,
  PublicService,
} from "@northgraindata/dsui-core";

/** Canonical server contracts. New code uses these; see legacy aliases below. */
export type { HealthStatus, PageDocument, PublicAdapter, PublicService };
export type Health = HealthStatus["status"];

export type Service = {
  id: string;
  name: string;
  adapter: string;
  category: string;
  endpoint?: string;
  health: Health;
  detail?: string;
  latencyMs?: number;
  managedBy?: "configuration" | "ui";
  capabilities?: string[];
  mocked?: boolean;
  logo?: string;
};
export type Adapter = {
  id: string;
  name: string;
  category: string;
  description: string;
  logo?: string;
  fields: Field[];
  connectionMethods?: ConnectionMethod[];
};

export type Field = {
  key: string;
  label: string;
  type?: "text" | "password" | "number" | "boolean" | "list" | "select";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type ConnectionMethod = {
  id: string;
  label: string;
  description?: string;
  fields: Field[];
  group?: {
    id: string;
    label: string;
    description?: string;
  };
};

type JsonSchema = Record<string, unknown>;

function schemaFields(schema: JsonSchema | undefined): Field[] {
  if (!schema) return [];
  const properties = schema.properties;
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  )
    return [];
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((key): key is string => typeof key === "string")
      : [],
  );
  return Object.entries(properties).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const field = value as JsonSchema;
    const type = Array.isArray(field.type)
      ? field.type.find((entry) => entry !== "null")
      : field.type;
    const enumValues = Array.isArray(field.enum)
      ? field.enum.filter((entry): entry is string => typeof entry === "string")
      : [];
    return [
      {
        key,
        label: key
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^./, (letter) => letter.toUpperCase()),
        type: enumValues.length
          ? "select"
          : type === "boolean"
            ? "boolean"
            : type === "number" || type === "integer"
              ? "number"
              : /token|password|secret|key/i.test(key)
                ? "password"
                : "text",
        ...(enumValues.length
          ? {
              options: enumValues.map((option) => ({
                label: option,
                value: option,
              })),
            }
          : {}),
        required: required.has(key),
      },
    ];
  });
}

export type ConnectionTopEntry =
  | { kind: "method"; method: ConnectionMethod }
  | {
      kind: "group";
      id: string;
      label: string;
      description?: string;
      methods: ConnectionMethod[];
    };

/**
 * Groups connection methods into top-level tabs: ungrouped methods stand
 * alone, grouped methods collect under their group in first-seen order.
 */
export function connectionTopEntries(
  methods?: ConnectionMethod[],
): ConnectionTopEntry[] {
  const entries: ConnectionTopEntry[] = [];
  const groups = new Map<
    string,
    Extract<ConnectionTopEntry, { kind: "group" }>
  >();
  for (const method of methods ?? []) {
    if (!method.group) {
      entries.push({ kind: "method", method });
      continue;
    }
    let entry = groups.get(method.group.id);
    if (!entry) {
      entry = {
        kind: "group",
        id: method.group.id,
        label: method.group.label,
        ...(method.group.description
          ? { description: method.group.description }
          : {}),
        methods: [],
      };
      groups.set(method.group.id, entry);
      entries.push(entry);
    }
    entry.methods.push(method);
  }
  return entries;
}

export function firstLeaf(
  top?: ConnectionTopEntry,
): ConnectionMethod | undefined {
  if (!top) return undefined;
  return top.kind === "group" ? top.methods[0] : top.method;
}

export function adapterFromPublicAdapter(adapter: PublicAdapter): Adapter {
  const fields = schemaFields(adapter.connectionSchema);
  const connectionMethods = adapter.connectionMethods?.map((method) => ({
    id: method.id,
    label: method.label,
    ...(method.description ? { description: method.description } : {}),
    fields: schemaFields(method.schema),
    ...(method.group ? { group: { ...method.group } } : {}),
  }));
  return {
    id: adapter.id,
    name: adapter.name,
    category: adapter.id,
    description: adapter.description,
    ...(adapter.iconUrl ? { logo: adapter.iconUrl } : {}),
    fields,
    ...(connectionMethods ? { connectionMethods } : {}),
  };
}
export type Manifest = {
  views: Array<{
    id: string;
    title: string;
    renderer: RendererKind;
    capability: string;
    kind?: string;
    description?: string;
    navigation?: {
      area: { id: string; label: string; order?: number };
      parent?: { capability: string };
    };
    databaseExplorer?: {
      databasesCapability: string;
      objectsCapability: string;
      databaseIdField: string;
      objectNameField: string;
      objectTypeField: string;
      tabs: Array<{
        id: string;
        label: string;
        capability: string;
        kind: "record-detail" | "record-list" | "code";
      }>;
    };
    columns?: Array<{ id: string; label: string; format?: string }>;
    actions?: Array<{ id: string; label: string; authorization: string }>;
    filters?: Array<{
      id: string;
      label: string;
      type: string;
      options?: Array<{ label: string; value: string }>;
    }>;
    fields?: Array<{
      id: string;
      label: string;
      description?: string;
      type:
        | "text"
        | "password"
        | "number"
        | "boolean"
        | "url"
        | "list"
        | "select";
      required?: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
    }>;
    detail?: string;
    idField?: string;
  }>;
};
/** Stable, server-declared renderer kinds. The browser maps these to owned UI renderers. */
export type RendererKind =
  | "query"
  | "schema-browser"
  | "database-explorer"
  | "table-browser"
  | "topic-browser"
  | "message-browser"
  | "consumer-groups"
  | "object-browser"
  | "job-browser"
  | "record-list"
  | "record-detail"
  | "tree"
  | "metrics"
  | "action-form"
  | "log-stream"
  | "service-info";
export type Renderer = "query-workbench" | Exclude<RendererKind, "query">;
export const rendererMap: Record<RendererKind, Renderer> = {
  query: "query-workbench",
  "schema-browser": "schema-browser",
  "database-explorer": "database-explorer",
  "table-browser": "table-browser",
  "topic-browser": "topic-browser",
  "message-browser": "message-browser",
  "consumer-groups": "consumer-groups",
  "object-browser": "object-browser",
  "job-browser": "job-browser",
  "log-stream": "log-stream",
  "record-list": "record-list",
  "record-detail": "record-detail",
  tree: "tree",
  metrics: "metrics",
  "action-form": "action-form",
  "service-info": "service-info",
};
export function normalizeRenderer(kind: string): Renderer {
  return rendererMap[kind as RendererKind] ?? "record-list";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError(
      "dsui API is unavailable. Check that the server is running.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      (await response.json().catch(() => ({ message: response.statusText })))
        .message ?? response.statusText,
      response.status,
    );
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function getServices() {
  const r = await request<Service[] | { data: Service[] }>("/services");
  return Array.isArray(r) ? r : r.data;
}
export async function getAdapters() {
  const r = await request<PublicAdapter[] | { data: PublicAdapter[] }>(
    "/adapters",
  );
  return (Array.isArray(r) ? r : r.data).map(adapterFromPublicAdapter);
}
export async function getServicePages(id: string) {
  return request<{ pages: Array<{ path: string }> }>(`/services/${id}/pages`);
}
export async function getPage(serviceId: string, path: string) {
  return request<PageDocument>(
    `/services/${serviceId}/page?path=${encodeURIComponent(path)}`,
  );
}
export async function executeResource(
  serviceId: string,
  resourceId: string,
  input: unknown,
) {
  return request<{ data: unknown }>(
    `/services/${serviceId}/resources/${resourceId}`,
    {
      method: "POST",
      body: JSON.stringify({ input }),
    },
  );
}
export async function executeAction(
  serviceId: string,
  actionId: string,
  input: unknown,
) {
  return request<
    { status: "success"; data: unknown } | { status: "error"; message: string }
  >(`/services/${serviceId}/actions/${actionId}`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}
export async function deleteService(id: string) {
  await request<void>(`/services/${id}`, { method: "DELETE" });
}
/** @deprecated The server no longer serves capability manifests. */
export async function getManifest(id: string): Promise<Manifest> {
  return request<Manifest>(`/services/${id}/manifest`);
}
export async function createService(input: unknown) {
  return request<Service>("/services", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function testService(input: unknown) {
  return request<HealthStatus>("/services/test", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
/** @deprecated The server no longer executes capabilities. Use executeResource/executeAction. */
export async function runOperation(
  serviceId: string,
  capability: string,
  input: unknown,
) {
  return request<{
    data: unknown;
    nextCursor?: string;
    warnings?: string[];
    columns?: string[];
    folders?: string[];
  }>(`/services/${serviceId}/capabilities/${capability}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function login(input: { email: string; password: string }) {
  return request<{ id: string; email: string; role: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function setupOwner(input: { email: string; password: string }) {
  return request<{ id: string; email: string; role: string }>("/auth/setup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}
export function titleFor(id: string) {
  return (
    (
      {
        query: "Query",
        "schema-browser": "Catalogs",
        "table-browser": "Tables",
        "topic-browser": "Topics",
        "message-browser": "Messages",
        "consumer-groups": "Consumer groups",
        "object-browser": "Objects",
        "job-browser": "Jobs",
        "log-stream": "Logs",
      } as Record<string, string>
    )[id] ?? id.replaceAll("-", " ")
  );
}
