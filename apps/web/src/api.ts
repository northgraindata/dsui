export type Health = "healthy" | "warning" | "unavailable" | "unknown";
export type Service = {
  id: string;
  name: string;
  adapter: string;
  category: string;
  endpoint: string;
  health: Health;
  detail?: string;
  latencyMs?: number;
  managedBy?: "configuration" | "ui";
  capabilities?: string[];
  logo?: string;
};
export type Adapter = {
  id: string;
  name: string;
  category: string;
  description: string;
  logo?: string;
  fields: Array<{
    key: string;
    label: string;
    type?: "text" | "password" | "number";
    placeholder?: string;
    required?: boolean;
  }>;
};
export type Manifest = {
  views: Array<{
    id: string;
    title: string;
    renderer: RendererKind;
    capability: string;
    kind?: string;
    description?: string;
    columns?: Array<{ id: string; label: string; format?: string }>;
    actions?: Array<{ id: string; label: string; authorization: string }>;
    filters?: Array<{ id: string; label: string; type: string }>;
    detail?: string;
    idField?: string;
  }>;
};
/** Stable, server-declared renderer kinds. The browser maps these to owned UI renderers. */
export type RendererKind =
  | "query"
  | "schema-browser"
  | "table-browser"
  | "topic-browser"
  | "message-browser"
  | "consumer-groups"
  | "object-browser"
  | "job-browser"
  | "record-list"
  | "record-detail"
  | "action-form"
  | "service-info";
export type Renderer = "query-workbench" | Exclude<RendererKind, "query">;
export const rendererMap: Record<RendererKind, Renderer> = {
  query: "query-workbench",
  "schema-browser": "schema-browser",
  "table-browser": "table-browser",
  "topic-browser": "topic-browser",
  "message-browser": "message-browser",
  "consumer-groups": "consumer-groups",
  "object-browser": "object-browser",
  "job-browser": "job-browser",
  "record-list": "record-list",
  "record-detail": "record-detail",
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
  const r = await request<Adapter[] | { data: Adapter[] }>("/adapters");
  return Array.isArray(r) ? r : r.data;
}
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
  return request<{ health: Health; detail?: string; latencyMs?: number }>(
    "/services/test",
    { method: "POST", body: JSON.stringify(input) },
  );
}
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
      } as Record<string, string>
    )[id] ?? id.replaceAll("-", " ")
  );
}
