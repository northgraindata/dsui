import type { ActionTarget } from "../../action";
import { defineComponent } from "../define";

export type NotebookCatalogItem = {
  id: string;
  title: string;
  description?: string;
  environment?: string;
  location?: string;
  updatedAt?: string;
  lastViewedAt?: string;
};

export interface NotebookCatalogProps {
  notebooks: readonly NotebookCatalogItem[];
  actions?: {
    create?: ActionTarget | string;
    import?: ActionTarget | string;
  };
}

export interface NotebookCatalogNode {
  readonly kind: "notebook-catalog";
  readonly props: NotebookCatalogProps;
}

export const NotebookCatalog = defineComponent<
  NotebookCatalogProps,
  NotebookCatalogNode
>({
  id: "notebook-catalog",
  path: "./ui/notebook-catalog",
});
