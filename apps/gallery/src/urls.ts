import type { Scenario } from "@northgraindata/dsui-ui-fixtures";
import { findRoute, routeKey } from "@northgraindata/dsui-ui-fixtures/routes";
import type { ManifestAdapter, ManifestPage } from "./data";

export function pageOnlyUrl(
  adapter: string,
  page: string,
  scenario: Scenario,
  options: { width?: string; at?: string } = {},
): string {
  const { width, at } = options;
  const search = new URLSearchParams({ adapter, page, scenario });
  if (at) search.set("at", at);
  if (width && width !== "full") search.set("width", width);
  return `/?${search}`;
}

/** The same page inside the real application. */
export function shellUrl(
  adapter: string,
  page: ManifestPage,
  scenario: Scenario,
): string {
  const [path = "", query] = page.href.split("?");
  const search = new URLSearchParams(query);
  search.set("scenario", scenario);
  return `/services/${adapter}${path === "/" ? "" : path}?${search}`;
}

/**
 * What an application URL shows: the matching page, and the fixture file that
 * holds the nodes for its query.
 */
export function resolveUrl(
  adapter: ManifestAdapter,
  href: string,
): { page: ManifestPage; file: string } | undefined {
  const [path = ""] = href.split("?");
  const page = findRoute(adapter.pages, path);
  return page && { page, file: adapter.variants[routeKey(href)] ?? page.slug };
}
