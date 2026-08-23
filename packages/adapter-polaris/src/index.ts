import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  baseUrl: z.string().url(),
  catalog: z.string().min(1),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  token: z.string().optional(),
});

const MAX_ROWS = 1000;
const trimSlash = (value: string) => value.replace(/\/+$/, "");

export const polarisAdapter = defineAdapter({
  id: "polaris",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "polaris",
    name: "Apache Polaris",
    category: "Catalog",
    description:
      "Browse Apache Polaris catalogs, namespaces, tables, and views.",
    icon: "polaris",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "baseUrl",
      label: "Server URL",
      type: "url",
      required: true,
      placeholder: "http://polaris:8181",
    },
    { id: "catalog", label: "Catalog", type: "text", required: true },
    { id: "clientId", label: "Client ID", type: "text" },
    {
      id: "clientSecret",
      label: "Client secret",
      type: "password",
      secret: true,
    },
    { id: "token", label: "Bearer token", type: "password", secret: true },
  ],
  secretPaths: ["clientSecret", "token"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Service information" },
    },
    {
      id: "catalogs",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Catalogs",
        columns: [
          { id: "name", label: "Catalog", format: "code" },
          { id: "type", label: "Type", format: "text" },
        ],
      },
    },
    {
      id: "namespaces",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Namespaces",
        columns: [
          { id: "catalog", label: "Catalog", format: "code" },
          { id: "namespace", label: "Namespace", format: "code" },
        ],
      },
    },
    {
      id: "tables",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Tables",
        columns: [
          { id: "catalog", label: "Catalog", format: "code" },
          { id: "namespace", label: "Namespace", format: "code" },
          { id: "table", label: "Table", format: "code" },
        ],
      },
    },
    {
      id: "views",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Views",
        columns: [
          { id: "catalog", label: "Catalog", format: "code" },
          { id: "namespace", label: "Namespace", format: "code" },
          { id: "view", label: "View", format: "code" },
        ],
      },
    },
    {
      id: "metrics",
      authorization: "inspect",
      view: { kind: "service-info", title: "Metrics" },
    },
  ],
  create(context, connection) {
    const request = context.fetch ?? fetch;
    let cachedToken: string | undefined;
    async function authenticate(): Promise<string> {
      if (cachedToken) return cachedToken;
      if (connection.token) {
        cachedToken = connection.token;
        return cachedToken;
      }
      if (connection.clientId && connection.clientSecret) {
        const url = `${trimSlash(connection.baseUrl)}/api/oauth/tokens`;
        const body = new URLSearchParams({ grant_type: "client_credentials" });
        const response = await request(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: context.signal,
        });
        if (!response.ok) {
          const detail = (await response.text().catch(() => "")) ?? "";
          throw new Error(
            `Polaris auth failed (${response.status}): ${detail.slice(0, 300)}`,
          );
        }
        const json = (await response.json()) as { access_token?: string };
        if (!json.access_token)
          throw new Error("Polaris auth returned no access token");
        cachedToken = json.access_token;
        return cachedToken;
      }
      throw new Error("Polaris requires a token or client credentials");
    }
    async function polarisGet<T>(path: string): Promise<T> {
      const token = await authenticate();
      const response = await request(
        `${trimSlash(connection.baseUrl)}${path}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: context.signal,
        },
      );
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")) ?? "";
        throw new Error(
          `Polaris ${path} (${response.status}): ${detail.slice(0, 300)}`,
        );
      }
      return (await response.json()) as T;
    }
    const catalogBase = `/api/catalog/v1/${encodeURIComponent(connection.catalog)}`;
    const nsPath = (ns: string[]) =>
      ns.map((segment) => encodeURIComponent(segment)).join("/");
    async function listNamespaces(): Promise<string[][]> {
      const json = await polarisGet<{
        namespaces?: { namespace: string[] }[];
      }>(`${catalogBase}/namespaces`);
      return (json.namespaces ?? []).map((entry) => entry.namespace);
    }
    type EntityRow = { namespace: string[]; name: string };
    async function collect(kind: "tables" | "views"): Promise<unknown[][]> {
      const namespaces = await listNamespaces();
      const rows: unknown[][] = [];
      for (const ns of namespaces) {
        const json = await polarisGet<{ identifiers?: EntityRow[] }>(
          `${catalogBase}/namespaces/${nsPath(ns)}/${kind}`,
        );
        for (const id of json.identifiers ?? []) {
          rows.push([connection.catalog, id.namespace.join("."), id.name]);
          if (rows.length >= MAX_ROWS) break;
        }
        if (rows.length >= MAX_ROWS) break;
      }
      return rows;
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await listNamespaces();
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to reach Apache Polaris",
          };
        }
      },
      async execute(operationId, _input) {
        if (operationId === "service-info")
          return {
            items: [
              {
                label: "Server",
                value: connection.baseUrl,
                format: "code",
              },
              {
                label: "Catalog",
                value: connection.catalog,
                format: "code",
              },
            ],
            columns: ["label", "value", "format"],
          };
        if (operationId === "catalogs") {
          const json = await polarisGet<{
            catalogs?: { name: string; type?: string }[];
          }>("/api/management/v1/catalogs");
          return {
            items: (json.catalogs ?? []).map((catalog) => [
              catalog.name,
              catalog.type ?? "",
            ]),
            columns: ["name", "type"],
          };
        }
        if (operationId === "namespaces") {
          const namespaces = await listNamespaces();
          return {
            items: namespaces.map((ns) => [connection.catalog, ns.join(".")]),
            columns: ["catalog", "namespace"],
          };
        }
        if (operationId === "tables" || operationId === "views") {
          const kind = operationId === "tables" ? "tables" : "views";
          const rows = await collect(kind);
          return {
            items: rows,
            columns: [
              "catalog",
              "namespace",
              kind === "tables" ? "table" : "view",
            ],
            ...(rows.length >= MAX_ROWS
              ? { warnings: [`Result truncated to ${rows.length} entries`] }
              : {}),
          };
        }
        if (operationId === "metrics") {
          const [catalogs, namespaces, tables] = await Promise.all([
            polarisGet<{ catalogs?: unknown[] }>(
              "/api/management/v1/catalogs",
            ).then((json) => json.catalogs ?? []),
            listNamespaces(),
            collect("tables"),
          ]);
          return {
            items: [
              {
                label: "Catalogs",
                value: catalogs.length,
                format: "number",
              },
              {
                label: "Namespaces",
                value: namespaces.length,
                format: "number",
              },
              {
                label: "Tables",
                value: tables.length,
                format: "number",
              },
            ],
            columns: ["label", "value", "format"],
          };
        }
        throw new Error(`Unsupported Polaris operation: ${operationId}`);
      },
    };
  },
});
export default polarisAdapter;
