import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";

export const explorerPage = definePage({
  path: "/explorer",
  render: () =>
    SplitPane({
      sidebar: dataExplorer("/explorer"),
      content: [
        PageHeader({
          title: "Data explorer",
          description: "Browse catalogs, schemas, tables and views.",
        }),
        KeyValue({
          title: "Explorer",
          data: {
            navigation: "Select a catalog, schema, table, or view.",
            search: "Search across the catalog from the explorer.",
          },
        }),
      ],
    }),
});
