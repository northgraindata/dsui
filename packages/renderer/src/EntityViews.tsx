import {
  type PageNode,
  parseEntityCatalog,
  parseEntityDetail,
} from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import { type KeyboardEvent, useId, useState } from "react";
import {
  Badge,
  EntityActionButton,
  EntityActions,
  EntityDialog,
  EntityIcon,
  EntityMore,
  EntityPanelView,
} from "./EntityPrimitives";
import { filterEntities, useEntityResource } from "./entity-hooks";
import type { RendererClient } from "./types";
import { WorkbenchIcon } from "./WorkbenchIcon";

function moveTab(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  length: number,
  select: (index: number) => void,
) {
  const next =
    event.key === "ArrowRight"
      ? (index + 1) % length
      : event.key === "ArrowLeft"
        ? (index + length - 1) % length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? length - 1
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  select(next);
  const buttons =
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
  buttons?.[next]?.focus();
}

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
        <div className="entity-catalog-toolbar">
          <div
            className="entity-tabs"
            role="tablist"
            aria-label="Catalog filters"
          >
            {filters.map((filter, index) => (
              <button
                type="button"
                key={filter.label}
                role="tab"
                id={`${id}-filter-${index}`}
                aria-controls={`${id}-results`}
                tabIndex={selected === index ? 0 : -1}
                aria-selected={selected === index}
                onClick={() => setSelected(index)}
                onKeyDown={(event) =>
                  moveTab(event, index, filters.length, setSelected)
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="entity-filter-controls">
            <label className="entity-search">
              <WorkbenchIcon name="search" />
              <input
                aria-label={node.props.searchPlaceholder ?? "Search catalog"}
                placeholder={node.props.searchPlaceholder ?? "Search catalog…"}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
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
          {data && (
            <div className="entity-table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Description</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Version</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="entity-name">
                          <span className="entity-row-icon">
                            <EntityIcon name={item.icon} />
                          </span>
                          <div>
                            {item.link ? (
                              <a
                                href={item.link}
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (item.link) client.navigate(item.link);
                                }}
                              >
                                {item.title}
                              </a>
                            ) : (
                              <strong>{item.title}</strong>
                            )}
                            {item.badge && <Badge badge={item.badge} />}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span>{item.description}</span>
                        {item.detail && <small>{item.detail}</small>}
                      </td>
                      <td>
                        {item.category && (
                          <span
                            className="entity-category"
                            data-color={item.categoryColor}
                          >
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td>
                        {item.status && <Badge badge={item.status} dot />}
                      </td>
                      <td>{item.version || "—"}</td>
                      <td>
                        <div className="entity-row-actions">
                          {item.actions?.[0] && (
                            <EntityActionButton
                              action={{ ...item.actions[0], primary: false }}
                            />
                          )}
                          <EntityMore
                            title={item.title}
                            actions={[
                              ...(item.link
                                ? [
                                    {
                                      label: "View details",
                                      icon: "file",
                                      link: item.link,
                                    },
                                  ]
                                : []),
                              ...(item.actions?.slice(1) ?? []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length && (
                <p className="entity-empty" role="status">
                  No items match your filters.
                </p>
              )}
            </div>
          )}
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

export function EntityDetailView({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "entity-detail" }>;
}) {
  const { data, error, reload } = useEntityResource(
    client,
    node.props.source,
    parseEntityDetail,
  );
  const [selected, setSelected] = useState("");
  const id = useId();
  if (!data)
    return (
      <div className="entity-page entity-detail">
        {error ? (
          <p role="alert">
            {error}
            <Button type="button" variant="secondary" onClick={reload}>
              Try again
            </Button>
          </p>
        ) : (
          <p role="status">Loading details…</p>
        )}
      </div>
    );
  const tab = data.tabs.find((item) => item.id === selected) ?? data.tabs[0];
  if (!tab) return null;
  return (
    <div className="entity-page entity-detail">
      <EntityActions client={client} refresh={reload} selectTab={setSelected}>
        <nav className="entity-breadcrumbs" aria-label="Breadcrumb">
          {data.breadcrumbs?.map((crumb, index) => (
            <span key={crumb.path ?? crumb.label}>
              {index > 0 && <WorkbenchIcon name="chevron" size={12} />}
              {crumb.path ? (
                <button
                  type="button"
                  onClick={() => {
                    if (crumb.path) client.navigate(crumb.path);
                  }}
                >
                  {crumb.label}
                </button>
              ) : (
                <span aria-current="page">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        <header className="entity-detail-heading">
          <span className="entity-detail-icon">
            <EntityIcon name={data.icon} size={38} />
          </span>
          <div className="entity-detail-identity">
            <div className="entity-title-line">
              <h1>{data.title}</h1>
              {data.status && <Badge badge={data.status} />}
            </div>
            <p>{data.description}</p>
            <div className="entity-tags">
              {data.tags?.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="entity-detail-actions">
            {data.version && (
              <span className="entity-version">
                {data.version}
                <WorkbenchIcon name="chevron-down" size={14} />
              </span>
            )}
            {data.actions?.[0] && (
              <EntityActionButton action={data.actions[0]} />
            )}
            {data.actions && data.actions.length > 1 && (
              <EntityMore title={data.title} actions={data.actions.slice(1)} />
            )}
          </div>
        </header>
        <div
          className="entity-tabs entity-detail-tabs"
          role="tablist"
          aria-label="Details"
        >
          {data.tabs.map((item, index) => (
            <button
              type="button"
              role="tab"
              id={`${id}-${item.id}`}
              key={item.id}
              aria-controls={`${id}-content`}
              aria-selected={tab.id === item.id}
              tabIndex={tab.id === item.id ? 0 : -1}
              onClick={() => setSelected(item.id)}
              onKeyDown={(event) =>
                moveTab(event, index, data.tabs.length, (next) => {
                  const target = data.tabs[next];
                  if (target) setSelected(target.id);
                })
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="entity-error">
            {error}
            <Button type="button" variant="secondary" onClick={reload}>
              Try again
            </Button>
          </p>
        )}
        <div
          role="tabpanel"
          id={`${id}-content`}
          aria-labelledby={`${id}-${tab.id}`}
          className="entity-detail-columns"
          data-aside={Boolean(tab.aside?.length)}
        >
          <div className="entity-panel-column">
            {tab.panels.map((panel) => (
              <EntityPanelView key={panel.title} panel={panel} />
            ))}
          </div>
          {tab.aside?.length ? (
            <aside className="entity-panel-column">
              {tab.aside.map((panel) => (
                <EntityPanelView key={panel.title} panel={panel} />
              ))}
            </aside>
          ) : null}
        </div>
      </EntityActions>
    </div>
  );
}
