const explanations: Record<string, string> = {
  "000630": "The statement exceeded its statement or warehouse timeout.",
  "002003":
    "The object does not exist, or the configured role is not authorized to see it.",
  "003001":
    "The configured role has insufficient privileges for this operation.",
  "390100": "Authentication failed. Check username, password, or key pair.",
  "390144": "The authentication token has expired. Reconnect to continue.",
};

/** Turn a Snowflake driver error into a short message that names the likely fix. */
export function explainSnowflakeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (typeof error.code === "string" || typeof error.code === "number")
      ? String(error.code).padStart(6, "0")
      : undefined;
  const explanation = code ? explanations[code] : undefined;
  return explanation ? `${explanation} (${message})` : message;
}
