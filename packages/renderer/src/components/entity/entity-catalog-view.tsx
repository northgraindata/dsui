import { type PageNode, parseEntityCatalog } from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import { useId, useState } from "react";
import type { RendererClient } from "../../types/renderer-types";
import { WorkbenchIcon } from "../icons";
import { EntityCatalogTable } from "./entity-catalog-table";
import { EntityFilterBar } from "./entity-filter-bar";
import { filterEntities, useEntityResource } from "./entity-hooks";
import {
  EntityActionButton,
  EntityActions,
  EntityDialog,
  EntityIcon,
} from "./entity-primitives";

export function EntityCatalogView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "entity-catalog" }>;
}) {
  const { data, error, reload } = useEntityResource(
    client,
    node.props.source,
    parseEntityCatalog,
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);
  const [installSearch, setInstallSearch] = useState("");
  const id = useId();
  const filters = node.props.filters ?? [{ label: "All items" }];
  const items = data
    ? filterEntities(data, search, category, filters[selected])
    : [];
  const categories = [
    ...new Set(
      data?.flatMap((item) => (item.category ? [item.category] : [])) ?? [],
    ),
  ].sort();
  const installable =
    data?.filter(
      (item) =>
        item.actions?.some(
          (action) => action.primary && !action.disabledReason,
        ) &&
        `${item.title} ${item.description}`
          .toLowerCase()
          .includes(installSearch.toLowerCase()),
    ) ?? [];
  return (
    <div className="entity-page entity-catalog">
      <EntityActions client={client} refresh={reload}>
        <header className="entity-catalog-heading">
          <span className="entity-catalog-logo">
            <EntityIcon name={node.props.icon} size={80} />
          </span>
          <div>
            <h1>{node.props.title}</h1>
            {node.props.subtitle && <p>{node.props.subtitle}</p>}
            {node.props.description && <p>{node.props.description}</p>}
          </div>
          {node.props.createLabel && (
            <Button
              type="button"
              className="entity-create"
              onClick={() => setInstallOpen(true)}
            >
              <WorkbenchIcon name="plus" />
              {node.props.createLabel}
            </Button>
          )}
        </header>
        <EntityFilterBar
          id={id}
          filters={filters}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearch={setSearch}
          searchPlaceholder={node.props.searchPlaceholder}
          category={category}
          categories={categories}
          onCategory={setCategory}
        />
        <div
          role="tabpanel"
          id={`${id}-results`}
          aria-labelledby={`${id}-filter-${selected}`}
        >
          {error && (
            <div className="entity-error" role="alert">
              {error}
              <Button type="button" variant="secondary" onClick={reload}>
                Try again
              </Button>
            </div>
          )}
          {!data && !error && (
            <p className="entity-loading" role="status">
              Loading catalog…
            </p>
          )}
          {data && <EntityCatalogTable client={client} items={items} />}
        </div>
        {installOpen && (
          <EntityDialog
            title={node.props.createLabel ?? "Add item"}
            description="Choose an available item."
            close={() => setInstallOpen(false)}
          >
            <label className="entity-search">
              <WorkbenchIcon name="search" />
              <input
                aria-label="Find an available item"
                placeholder="Search available items…"
                value={installSearch}
                onChange={(event) => setInstallSearch(event.target.value)}
              />
            </label>
            <div className="entity-install-list">
              {installable.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  {item.actions
                    ?.filter((action) => action.primary)
                    .map((action) => (
                      <EntityActionButton key={action.label} action={action} />
                    ))}
                </div>
              ))}
              {!installable.length && (
                <p>No available items match your search.</p>
              )}
            </div>
          </EntityDialog>
        )}
      </EntityActions>
    </div>
  );
}
