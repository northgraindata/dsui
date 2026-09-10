import type {
  CatalogFilter,
  EntityItem,
  ResourceReference,
} from "@northgraindata/dsui-core";
import { useCallback, useEffect, useState } from "react";
import type { RendererClient } from "./types";

export function filterEntities(
  items: EntityItem[],
  search: string,
  category: string,
  filter?: CatalogFilter,
) {
  const query = search.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (!category || item.category === category) &&
      (!filter?.field || item.attributes?.[filter.field] === filter.equals) &&
      (!query ||
        `${item.title} ${item.description} ${item.detail ?? ""}`
          .toLocaleLowerCase()
          .includes(query)),
  );
}

export function useEntityResource<T>(
  client: RendererClient,
  source: ResourceReference,
  parse: (value: unknown) => T,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version explicitly invalidates the resource after an action.
  useEffect(() => {
    let active = true;
    setError(undefined);
    client
      .executeResource(source)
      .then((value) => {
        const next = parse(value);
        if (active) setData(next);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load this page",
          );
      });
    return () => {
      active = false;
    };
  }, [client, source, parse, version]);
  return { data, error, reload };
}
