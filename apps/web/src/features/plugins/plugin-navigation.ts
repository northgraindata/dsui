import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";

export type PluginNavigationGroup = {
  label: string;
  items: Array<PluginCatalog["navigation"][number] & { iconUrl?: string }>;
};

/** Group the caller's catalog only; never reconstruct hidden contributions. */
export function groupPluginNavigation(
  catalog: Pick<PluginCatalog, "plugins" | "navigation">,
): PluginNavigationGroup[] {
  const plugins = new Map(catalog.plugins.map((plugin) => [plugin.id, plugin]));
  const groups = new Map<string, PluginNavigationGroup>();
  for (const item of catalog.navigation) {
    const plugin = plugins.get(item.pluginId);
    if (plugin?.status !== "ready") continue;
    const label = plugin.category?.trim() || "Extensions";
    let group = groups.get(label);
    if (!group) {
      group = { label, items: [] };
      groups.set(label, group);
    }
    // An entry may carry its own icon when one plugin has several entries.
    group.items.push({ ...item, iconUrl: item.iconUrl ?? plugin.iconUrl });
  }
  return [...groups.values()].sort((left, right) => {
    if (left.label === right.label) return 0;
    if (left.label === "Extensions") return 1;
    if (right.label === "Extensions") return -1;
    return left.label.localeCompare(right.label);
  });
}
