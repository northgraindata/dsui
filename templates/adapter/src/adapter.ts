import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  endpoint: z.string().url(),
  token: z.string().min(1),
});

export default defineAdapter({
  id: "example-service",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "example-service",
    name: "Example Service",
    category: "Data service",
    description: "An example dsui adapter.",
  },
  connectionSchema,
  connectionFields: [
    { id: "endpoint", label: "Endpoint", type: "url", required: true },
    {
      id: "token",
      label: "API token",
      type: "password",
      required: true,
      secret: true,
    },
  ],
  secretPaths: ["token"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Service information" },
    },
    {
      id: "resources",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "key-value-browser",
        title: "Resources",
        columns: [
          { id: "name", label: "Name", format: "code" },
          { id: "status", label: "Status", format: "status" },
        ],
      },
    },
  ],
  create(context, connection) {
    const request = context.fetch ?? fetch;
    return {
      async health() {
        const started = Date.now();
        try {
          const response = await request(`${connection.endpoint}/health`, {
            headers: { Authorization: `Bearer ${connection.token}` },
            signal: context.signal,
          });
          return {
            status: response.ok ? "healthy" : "warning",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
          };
        }
      },
      async execute(operationId) {
        if (operationId === "service-info")
          return {
            items: [
              { label: "Endpoint", value: connection.endpoint, format: "code" },
            ],
          };
        if (operationId === "resources") {
          const response = await request(`${connection.endpoint}/resources`, {
            headers: { Authorization: `Bearer ${connection.token}` },
            signal: context.signal,
          });
          if (!response.ok)
            throw new Error(
              `Example Service request failed (${response.status})`,
            );
          return response.json();
        }
        throw new Error(`Unsupported operation: ${operationId}`);
      },
    };
  },
});
