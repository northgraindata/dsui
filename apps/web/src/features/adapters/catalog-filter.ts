import type { Adapter } from "../../api";

export function filterAdapterCatalog(
  adapters: Adapter[],
  query: string,
  category: string | null,
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return adapters.filter((adapter) => {
    if (category && adapter.category !== category) return false;
    const text = [
      adapter.name,
      adapter.description,
      adapter.author,
      adapter.category,
      ...(adapter.presentation?.features ?? []).map(
        (feature) => `${feature.title} ${feature.description ?? ""}`,
      ),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
