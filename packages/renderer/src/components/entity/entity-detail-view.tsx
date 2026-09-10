import { type PageNode, parseEntityDetail } from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import { useId, useState } from "react";
import type { RendererClient } from "../../types/renderer-types";
import { WorkbenchIcon } from "../icons";
import { useEntityResource } from "./entity-hooks";
import {
  Badge,
  EntityActionButton,
  EntityActions,
  EntityIcon,
  EntityMore,
  EntityPanelView,
} from "./entity-primitives";
import { moveEntityTab } from "./entity-tabs";

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
                moveEntityTab(event, index, data.tabs.length, (next) => {
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
