/**
 * Matches a concrete URL against a page path pattern.
 *
 * @param path - Route pattern, e.g. `"/databases/:database"`.
 * @param url - Concrete URL, e.g. `"/databases/ANALYTICS"`.
 * @returns Decoded params, or `null` when segments differ.
 *
 * @example
 * ```ts
 * matchRoute("/databases/:database", "/databases/ANALYTICS");
 * // { database: "ANALYTICS" }
 * matchRoute("/databases/:database", "/warehouses/W"); // null
 * ```
 */
export function matchRoute(
  path: string,
  url: string,
): Record<string, string> | null {
  const pathSegments = path.split("/").filter((s) => s.length > 0);
  const urlSegments = url.split("/").filter((s) => s.length > 0);
  if (pathSegments.length !== urlSegments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pathSegments.length; i++) {
    const pattern = pathSegments[i];
    const actual = urlSegments[i];
    if (pattern.startsWith(":")) {
      const name = pattern.slice(1);
      if (!name || actual.length === 0) return null;
      params[name] = decodeURIComponent(actual);
    } else if (pattern !== actual) {
      return null;
    }
  }
  return params;
}
