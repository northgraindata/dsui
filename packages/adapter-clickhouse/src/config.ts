import { z } from "@northgraindata/dsui-adapter-sdk";

const booleanish = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false" || value === "") return false;
  return value;
}, z.boolean());
const common = {
  database: z.string().min(1).default("default"),
  databaseScope: z.enum(["all", "selected"]).default("all"),
  username: z.string().optional(),
  password: z.string().optional(),
  accessToken: z.string().min(1).optional(),
  caCert: z.string().min(1).optional(),
  clientCert: z.string().min(1).optional(),
  clientKey: z.string().min(1).optional(),
  proxyUrl: z.string().url().optional(),
  pathname: z.string().default(""),
  requestTimeoutMs: z.coerce
    .number()
    .int()
    .min(1000)
    .max(600_000)
    .default(70_000),
  executionTimeoutSeconds: z.coerce.number().int().min(1).max(600).default(60),
  maxConnections: z.coerce.number().int().min(1).max(100).default(10),
  keepAlive: booleanish.default(true),
  compression: booleanish.default(true),
  readOnly: booleanish.default(false),
  showSystemDatabases: booleanish.default(false),
  roles: z.string().default(""),
  // JSON text keeps the generic connection form usable without a custom editor.
  headersJson: z.string().default("{}"),
  settingsJson: z.string().default("{}"),
};

export const structuredSchema = z.object({
  ...common,
  host: z.string().min(1),
  protocol: z.enum(["https", "http"]).default("https"),
  port: z.coerce.number().int().min(1).max(65535).optional(),
});
export const urlSchema = z.object({ ...common, url: z.string().url() });
export const connectionSchema = z.discriminatedUnion("method", [
  structuredSchema.extend({ method: z.literal("structured") }),
  urlSchema.extend({ method: z.literal("url") }),
]);
export type ClickHouseConfig = z.output<typeof connectionSchema>;

const settingsSchema = z.record(
  z.union([z.string(), z.number().finite(), z.boolean()]),
);
const headersSchema = z.record(z.string());
const reservedHeaders =
  /^(authorization|host|connection|content-length|transfer-encoding|content-type|accept-encoding|x-clickhouse-.*)$/i;
const reservedSettings =
  /^(database|user|password|query|query_id|session_id|session_timeout|role|readonly|(?:format_)?display_secrets_in_show_and_select|max_execution_time|max_result_rows|max_result_bytes|result_overflow_mode|output_format_.*|default_format|wait_end_of_query|send_progress_in_http_headers)$/i;

function endpoint(config: ClickHouseConfig): URL {
  let url: URL;
  try {
    if (config.method === "url") url = new URL(config.url);
    else {
      if (/[\s/@?#]/.test(config.host)) throw new Error("Invalid host");
      const host =
        config.host.includes(":") && !config.host.startsWith("[")
          ? `[${config.host}]`
          : config.host;
      const port = config.port ?? (config.protocol === "https" ? 8443 : 8123);
      url = new URL(`${config.protocol}://${host}:${port}`);
    }
  } catch {
    throw new Error(
      "Invalid ClickHouse endpoint. Use a hostname/IP and separate port, or an HTTP(S) URL.",
    );
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error(
      "Use a ClickHouse HTTP(S) endpoint, not a native connection URI.",
    );
  if (url.hash) throw new Error("Connection URLs cannot contain fragments.");
  if (url.search)
    throw new Error(
      "Use Settings JSON and authentication fields instead of URL query parameters.",
    );
  return url;
}
function credentials(config: ClickHouseConfig, url: URL) {
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const basicFields =
    config.username !== undefined || config.password !== undefined;
  if ((username || password) && (basicFields || config.accessToken))
    throw new Error(
      "Choose URL credentials or authentication fields, not both.",
    );
  if (config.accessToken && basicFields)
    throw new Error(
      "Bearer authentication cannot be combined with username/password.",
    );
  if (config.accessToken && config.clientCert)
    throw new Error(
      "Choose bearer authentication or client-certificate authentication.",
    );
  return {
    username: username || config.username || "default",
    password: password || config.password || "",
  };
}
function validateTransport(config: ClickHouseConfig, url: URL) {
  if (!!config.clientCert !== !!config.clientKey)
    throw new Error(
      "Client certificate and private key must be supplied together.",
    );
  if ((config.caCert || config.clientCert) && url.protocol !== "https:")
    throw new Error("TLS certificates require HTTPS.");
  if (config.pathname && !config.pathname.startsWith("/"))
    throw new Error("Proxy pathname must start with /.");
  if (config.method === "url" && url.pathname !== "/" && config.pathname)
    throw new Error("Specify the proxy path in either the URL or pathname.");
  if (
    config.proxyUrl &&
    !["http:", "https:"].includes(new URL(config.proxyUrl).protocol)
  )
    throw new Error("Proxy URL must use HTTP(S).");
}
function parseHeaders(text: string) {
  let headers: Record<string, string>;
  try {
    headers = headersSchema.parse(JSON.parse(text));
  } catch {
    throw new Error("Headers JSON must be an object containing string values.");
  }
  const invalidNames = Object.keys(headers).some(
    (name) =>
      reservedHeaders.test(name) || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name),
  );
  if (
    invalidNames ||
    Object.values(headers).some((value) => /[\r\n]/.test(value))
  )
    throw new Error("Custom headers contain a reserved or invalid header.");
  return headers;
}
function parseSettings(text: string) {
  let settings: z.output<typeof settingsSchema>;
  try {
    settings = settingsSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "Settings JSON must be an object containing string, number, or boolean values.",
    );
  }
  if (
    Object.keys(settings).some(
      (name) => reservedSettings.test(name) || !/^[a-z][a-z0-9_]*$/.test(name),
    )
  )
    throw new Error(
      "Settings JSON contains an adapter-managed or invalid setting.",
    );
  return settings;
}
export function normalizeConfig(config: ClickHouseConfig) {
  const url = endpoint(config);
  const auth = credentials(config, url);
  validateTransport(config, url);
  return {
    url: url.origin,
    pathname: config.pathname || (url.pathname === "/" ? "" : url.pathname),
    ...auth,
    headers: parseHeaders(config.headersJson),
    settings: parseSettings(config.settingsJson),
    roles: config.roles
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
  };
}
