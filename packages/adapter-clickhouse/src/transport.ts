import { Agent as HttpsAgent } from "node:https";
import { ClickHouseLogLevel, createClient } from "@clickhouse/client";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { type ClickHouseConfig, normalizeConfig } from "./config.js";
export function createDriver(config: ClickHouseConfig, control: boolean) {
  const normalized = normalizeConfig(config);
  const tls = {
    ...(config.caCert ? { ca: config.caCert } : {}),
    ...(config.clientCert
      ? { cert: config.clientCert, key: config.clientKey }
      : {}),
    rejectUnauthorized: true,
  };
  const makeAgent = (maxSockets: number) => {
    const options = { keepAlive: config.keepAlive, maxSockets };
    if (config.proxyUrl && normalized.url.startsWith("https:")) {
      const agent = new HttpsProxyAgent(config.proxyUrl, options);
      Object.assign(agent.options, tls);
      const connect = agent.connect.bind(agent);
      // Proxy TLS and target TLS have separate trust and client identities.
      agent.connect = (request, target) =>
        connect(request, { ...target, ...tls });
      return agent;
    }
    if (config.proxyUrl) return new HttpProxyAgent(config.proxyUrl, options);
    if (config.caCert || config.clientCert)
      return new HttpsAgent({ ...tls, ...options });
    return undefined;
  };
  return createClient({
    url: normalized.url,
    pathname: normalized.pathname,
    database: config.database,
    ...(config.accessToken
      ? { access_token: config.accessToken }
      : { username: normalized.username, password: normalized.password }),
    request_timeout: control ? 10_000 : config.requestTimeoutMs,
    max_open_connections: control ? 1 : config.maxConnections,
    keep_alive: { enabled: config.keepAlive },
    compression: {
      response: config.compression,
      request: config.compression,
    },
    http_headers: {
      ...normalized.headers,
      ...(config.clientCert
        ? {
            "X-ClickHouse-User": normalized.username,
            "X-ClickHouse-SSL-Certificate-Auth": "on",
          }
        : {}),
    },
    set_basic_auth_header: !config.clientCert,
    log: { level: ClickHouseLogLevel.OFF },
    role: normalized.roles,
    application: "dsui",
    http_agent: makeAgent(control ? 1 : config.maxConnections),
    clickhouse_settings: {
      ...normalized.settings,
      default_format: "JSONCompact",
      format_display_secrets_in_show_and_select: 0,
      max_execution_time: config.executionTimeoutSeconds,
      output_format_json_quote_64bit_integers: 1,
      output_format_json_quote_64bit_floats: 1,
      output_format_json_quote_decimals: 1,
      output_format_json_quote_denormals: 1,
      ...(config.readOnly ? { readonly: "1" } : {}),
    },
  });
}
export type Driver = ReturnType<typeof createDriver>;
