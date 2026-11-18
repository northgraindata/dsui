const explanations: Record<string, string> = {
  "60": "The requested table does not exist or is not visible.",
  "62": "SQL syntax is invalid. Check the statement and object identifiers.",
  "81": "The selected database does not exist or is not visible.",
  "139":
    "This server has no configuration for the requested operational feature (for example Keeper).",
  "159": "The query exceeded its execution timeout.",
  "164": "The connection is read-only; this operation is not permitted.",
  "193": "Authentication failed. Check username, password, or token expiry.",
  "194": "Authentication failed. Check username, password, or token expiry.",
  "241": "The server memory limit was exceeded. Narrow the query.",
  "396":
    "The result exceeded the configured row or byte limit. Add LIMIT or narrow the query.",
  "497": "The configured role does not have permission for this operation.",
  "516": "Authentication failed. Check username, password, or token expiry.",
  ECONNREFUSED:
    "Connection refused. Check endpoint, port, and server availability.",
  ENOTFOUND: "DNS lookup failed. Check the hostname and DSUI server network.",
  EAI_AGAIN: "DNS lookup failed temporarily. Check DSUI server network.",
  CERT_HAS_EXPIRED: "The server TLS certificate has expired.",
  ERR_TLS_CERT_ALTNAME_INVALID:
    "The server TLS certificate does not match the endpoint hostname.",
  DEPTH_ZERO_SELF_SIGNED_CERT:
    "The server certificate is not trusted. Configure its CA certificate.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    "The server certificate chain is not trusted. Configure its CA certificate.",
  ETIMEDOUT:
    "The connection timed out. Check endpoint, network, and timeout settings.",
  ECONNRESET:
    "The connection was reset. Check proxy timeouts and HTTP(S) versus native port selection.",
};
export class ClickHouseRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
export function requestError(error: unknown): Error {
  const code = errorCode(error);
  return new ClickHouseRequestError(
    `ClickHouse request failed${code ? ` (code ${code})` : ""}. ${code && explanations[code] ? explanations[code] : "Check endpoint, TLS, credentials, permissions, SQL, and execution limits."} Writes may have completed; inspect before retrying.`,
    code,
  );
}
export function inspectionStatus(error: unknown): string {
  if (!(error instanceof ClickHouseRequestError)) return "error";
  if (error.code === "497") return "unauthorized";
  if (["60", "81", "139"].includes(error.code ?? "")) return "unavailable";
  return "error";
}
function errorCode(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  )
    return undefined;
  return /^\d+$/.test(error.code) || Object.hasOwn(explanations, error.code)
    ? error.code
    : undefined;
}
