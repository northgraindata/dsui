import {
  type PluginCatalog,
  resolvePluginPage,
} from "@northgraindata/dsui-plugin-sdk";

/** Public plugin pages remain reachable while every app screen requires sign-in. */
export function isPublicPluginPage(
  pathname: string,
  pages: PluginCatalog["pages"],
): boolean {
  const match = /^\/plugins\/([^/]+)\/(.+)$/.exec(pathname);
  const pluginId = match?.[1];
  const pageId = match?.[2];
  if (!pluginId || !pageId) return false;
  return Boolean(
    resolvePluginPage(
      pages.filter(
        (candidate) => candidate.pluginId === decodeURIComponent(pluginId),
      ),
      decodeURIComponent(pageId),
    )?.public,
  );
}
