/**
 * Shared primitives for fetching adapter sources.
 *
 * Adapter source is third-party code, so downloads are restricted to
 * credential-free HTTPS on allowlisted hosts and bounded in size. These checks
 * establish where bytes come from, not whether they are safe to execute; see
 * `build.ts` for the trust boundary.
 */

export type AdapterFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export class ExternalAdapterError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExternalAdapterError";
  }
}

/** Hosts an adapter source may be fetched from. */
const ALLOWED_HOSTS = new Set([
  "api.github.com",
  "codeload.github.com",
  "raw.githubusercontent.com",
  "registry.npmjs.org",
]);

export function assertSafeAdapterUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExternalAdapterError("Invalid adapter source URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  )
    throw new ExternalAdapterError(
      "Adapter downloads require credential-free HTTPS",
    );
  if (!ALLOWED_HOSTS.has(url.hostname))
    throw new ExternalAdapterError("Adapter download host is not allowlisted");
  return url;
}
