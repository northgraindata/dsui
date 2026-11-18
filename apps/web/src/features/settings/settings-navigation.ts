import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";

export function settingsEntries(catalog: PluginCatalog) {
  const ready = new Set(
    catalog.plugins
      .filter((plugin) => plugin.status === "ready")
      .map((plugin) => plugin.id),
  );
  return catalog.pages
    .filter(
      (page) =>
        ready.has(page.pluginId) &&
        page.settings &&
        !page.public &&
        !page.path?.includes(":") &&
        !page.path?.includes("*"),
    )
    .sort(
      (a, b) =>
        (a.settings?.order ?? 0) - (b.settings?.order ?? 0) ||
        a.title.localeCompare(b.title),
    );
}
