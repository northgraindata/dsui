import {
  definePage,
  PageHeader,
  QueryEditor,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../actions/run-query.js";
import { databases, relations, schemas } from "../resources/catalog.js";

export const queryPage = definePage({
  path: "/query",
  render: ({ query }) => [
    PageHeader({
      title: "Query",
      description: "Write and run SQL against this DuckDB instance.",
    }),
    QueryEditor({
      language: "sql",
      value: query.get("sql") ?? undefined,
      action: runQuery,
      explorer: {
        source: databases(),
        children: {
          source: schemas({ database: "$name" }),
          children: {
            source: relations({
              database: "$database",
              schema: "$name",
              type: "all",
            }),
          },
        },
      },
    }),
  ],
});
