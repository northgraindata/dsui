import type { CatalogFilter } from "@northgraindata/dsui-core";
import type { DataSource } from "../resource/index";
import { defineComponent } from "./custom";

export interface EntityCatalogProps {
  source: DataSource;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  filters?: CatalogFilter[];
  /** Opens a picker of items with a primary action, e.g. Install. */
  createLabel?: string;
  searchPlaceholder?: string;
}
export interface EntityCatalogNode {
  readonly kind: "entity-catalog";
  readonly props: EntityCatalogProps;
}
export interface EntityDetailNode {
  readonly kind: "entity-detail";
  readonly props: { source: DataSource };
}

/** A searchable, filterable catalog of resource-supplied entity records. */
export const EntityCatalog = defineComponent<
  EntityCatalogProps,
  EntityCatalogNode
>({
  id: "entity-catalog",
  render: (props) => {
    if (!props.title.trim()) throw new Error("EntityCatalog requires a title");
    if (!props.source?.resourceId)
      throw new Error("EntityCatalog requires a resource binding");
    if (
      props.filters?.some(
        (filter) =>
          !filter.label ||
          (filter.field !== undefined && filter.equals === undefined),
      )
    )
      throw new Error("Catalog filters require a label and comparison value");
    return { kind: "entity-catalog", props: { ...props } };
  },
});

/** A resource-supplied entity header, tabs, and composable content panels. */
export const EntityDetail = defineComponent<
  { source: DataSource },
  EntityDetailNode
>({
  id: "entity-detail",
  render: (props) => {
    if (!props.source?.resourceId)
      throw new Error("EntityDetail requires a resource binding");
    return { kind: "entity-detail", props: { ...props } };
  },
});
