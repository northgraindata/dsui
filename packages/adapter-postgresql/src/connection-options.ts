import type { PostgreSQLConfig } from "./context.js";

export function sslOption(config: PostgreSQLConfig) {
  if (config.sslMode === "disable") return false;
  if (
    !config.sslRootCert &&
    !config.sslCert &&
    !config.sslKey &&
    config.sslMode !== "verify-ca"
  )
    return config.sslMode;
  return {
    rejectUnauthorized:
      config.sslMode === "verify-ca" || config.sslMode === "verify-full",
    ...(config.sslRootCert ? { ca: config.sslRootCert } : {}),
    ...(config.sslCert ? { cert: config.sslCert } : {}),
    ...(config.sslKey ? { key: config.sslKey } : {}),
  };
}
