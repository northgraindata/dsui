import type { PluginServiceCatalog } from "@northgraindata/dsui-plugin-sdk";
export async function listServices(catalog: PluginServiceCatalog, max: number) {
  const items: {
    id: string;
    name: string;
    adapter: string;
    iconUrl?: string;
  }[] = [];
  let cursor: string | undefined;
  do {
    const page = await catalog.list({
      limit: Math.min(100, max - items.length),
      ...(cursor ? { cursor } : {}),
    });
    items.push(
      ...page.items.map(({ id, name, adapter, iconUrl }) => ({
        id,
        name,
        adapter,
        ...(iconUrl ? { iconUrl } : {}),
      })),
    );
    cursor = page.nextCursor;
  } while (cursor && items.length < max);
  return items;
}
