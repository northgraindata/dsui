import type { EntityItem } from "@northgraindata/dsui-core";
import type { RendererClient } from "../../types/renderer-types";
import {
  Badge,
  EntityActionButton,
  EntityIcon,
  EntityMore,
} from "./entity-primitives";

export function EntityCatalogTable({
  client,
  items,
}: {
  client: RendererClient;
  items: readonly EntityItem[];
}) {
  return (
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
              <td>{item.status && <Badge badge={item.status} dot />}</td>
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
  );
}
