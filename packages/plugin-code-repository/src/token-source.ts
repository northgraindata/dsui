import { PluginRequestError, z } from "@northgraindata/dsui-plugin-sdk";

/** Fetch a fresh token this long before the cached one expires. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

const responseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
});

/** Where short-lived GitHub tokens come from, instead of a token kept in the configuration. */
export interface GithubTokenSource {
  /** Asked for a token with the owner as `?owner=`. HTTPS, or loopback for development. */
  url: string;
  /** Sent as a bearer token to prove the request comes from this instance. */
  secret: string;
}

const cache = new Map<string, { token: string; expiresAt: number }>();

const keyOf = (source: GithubTokenSource, owner: string) =>
  `${source.url}\0${owner}`;

/** Forget a token, e.g. because GitHub refused it before the time it was said to last. */
export function forgetGithubToken(source: GithubTokenSource, owner: string) {
  cache.delete(keyOf(source, owner));
}

/** For tests: every cached token. */
export function clearGithubTokens() {
  cache.clear();
}

/**
 * A GitHub token for repositories of `owner`. It is kept until shortly before
 * it expires, so a fetch of many repositories asks once, and asked again when
 * it runs out. The secret is never put in an error message.
 */
export async function githubToken(
  source: GithubTokenSource,
  owner: string,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<string> {
  const key = keyOf(source, owner);
  const cached = cache.get(key);
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > now())
    return cached.token;

  const url = new URL(source.url);
  url.searchParams.set("owner", owner);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${source.secret}` },
      redirect: "error",
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    // Retried later by the fetch schedule: the broker may just be unreachable.
    throw new Error("Could not reach the GitHub token service");
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404
  )
    throw new PluginRequestError(
      "GitHub is not connected for this repository owner. Connect it again in DSUI Cloud.",
    );
  if (!response.ok)
    throw new Error(`The GitHub token service answered ${response.status}`);
  const parsed = responseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success)
    throw new Error("The GitHub token service sent an unexpected answer");
  cache.set(key, {
    token: parsed.data.token,
    expiresAt: Date.parse(parsed.data.expiresAt),
  });
  return parsed.data.token;
}
