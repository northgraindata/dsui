import type { PageNode } from "../components/index";
import { InvalidDefinitionError } from "../shared/errors";
import type { AnyStoreDefinition } from "../store/index";
import type { AnyPageDefinition, PageRenderContext } from "./types";

/**
 * Defines a page: a route that composes DSUI components and bindings.
 *
 * @param options.path - Absolute route path; `:segments` become typed params.
 * @param options.stores - Page-scoped stores created per scope.
 * @param options.render - Composes the component tree from params and stores.
 * @returns A page definition preserving the literal path for param inference.
 * @throws {@link InvalidDefinitionError} for relative paths or duplicate
 * store ids.
 *
 * @example
 * ```ts
 * export const databasePage = definePage({
 *   path: "/databases/:database",
 *   render: ({ params }) => [
 *     PageHeader({ title: params.database }),
 *     Table({ source: schemas({ database: params.database }) }),
 *   ],
 * });
 * ```
 */
export function definePage<TPath extends string>(options: {
  path: TPath;
  stores?: readonly AnyStoreDefinition[];
  render: (
    ctx: PageRenderContext<TPath>,
  ) => PageNode | readonly PageNode[];
}): AnyPageDefinition & { readonly path: TPath } {
  if (!options.path.startsWith("/"))
    throw new InvalidDefinitionError(
      `Page path must start with "/": ${options.path}`,
    );
  const stores = options.stores ? [...options.stores] : [];
  const ids = new Set<string>();
  for (const store of stores) {
    if (ids.has(store.id))
      throw new InvalidDefinitionError(`Duplicate page store: ${store.id}`);
    ids.add(store.id);
  }
  const render = options.render as AnyPageDefinition["render"];
  return { kind: "page", path: options.path, stores, render };
}
