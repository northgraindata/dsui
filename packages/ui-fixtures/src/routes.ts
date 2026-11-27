/** Matching between application URLs and adapter page patterns. */

/** Query parameters the gallery adds; they never change what a page renders. */
const GALLERY_PARAMS = ["scenario", "shell", "toolbar"];

/** The params an URL path supplies to a page pattern, if it matches. */
export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | undefined {
  const expected = pattern.split("/");
  const actual = path.split("/");
  if (expected.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, part] of expected.entries()) {
    const value = actual[index] ?? "";
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(value);
    else if (part !== value) return undefined;
  }
  return params;
}

/** The page behind a path; literal routes win over parameter routes. */
export function findRoute<T extends { readonly path: string }>(
  pages: readonly T[],
  path: string,
): T | undefined {
  const candidates = pages.filter((page) => matchRoute(page.path, path));
  return candidates.find((page) => !page.path.includes(":")) ?? candidates[0];
}

/** One name for every spelling of the same page URL. */
export function routeKey(href: string): string {
  const url = new URL(href, "http://fixtures.invalid");
  const search = new URLSearchParams(url.search);
  for (const name of GALLERY_PARAMS) search.delete(name);
  search.sort();
  const query = search.toString();
  return `${decodeURIComponent(url.pathname)}${query ? `?${query}` : ""}`;
}

/**
 * Links with a query that a page declares. The server renders such a page
 * differently, as with `?tab=graph`, so each needs its own fixture.
 */
export function queryLinks(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    if (value.startsWith("/") && value.includes("?") && !value.includes(":"))
      into.add(value);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) queryLinks(item, into);
  }
}
