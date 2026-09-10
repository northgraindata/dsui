import {
  definePage,
  KeyValue,
  PageHeader,
  SplitPane,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";

export const dataPage = definePage({
  path: "/data",
  render: () =>
    SplitPane({
      sidebar: dataExplorer("/data"),
      content: [
        PageHeader({
          title: "Data",
          description:
            "Browse DuckDB and attached databases from a single hierarchy.",
        }),
        KeyValue({
          title: "Explorer",
          data: {
            navigation: "Select a database, schema, table, or view.",
            search: "Search across the catalog from the explorer.",
          },
        }),
      ],
    }),
});
