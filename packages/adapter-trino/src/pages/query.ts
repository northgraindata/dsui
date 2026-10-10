import {
  definePage,
  PageHeader,
  QueryEditor,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../actions/index.js";
import { catalogs, schemas } from "../resources/index.js";

export const queryPage = definePage({
  path: "/query",
  render: () => [
    PageHeader({
      title: "Query editor",
      description: "Run SQL across connected Trino catalogs.",
    }),
    QueryEditor({
      language: "sql",
      action: runQuery,
      contextSelectors: [
        { name: "catalog", label: "Catalog", source: catalogs() },
        {
          name: "schema",
          label: "Schema",
          source: schemas({ catalog: "$catalog" }),
          dependsOn: ["catalog"],
        },
      ],
    }),
  ],
});
