import {
  definePage,
  PageHeader,
  QueryEditor,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../actions/sql.js";
import { databases, relations, schemas } from "../resources/schema.js";

export const queryPage = definePage({
  path: "/query",
  render: ({ query }) => [
    PageHeader({
      title: "Query",
      description:
        "Run a single SQL statement against Shaper's DuckDB. Results arrive as text.",
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
            source: relations({ database: "$database", schema: "$name" }),
            typeField: "type",
          },
        },
      },
    }),
  ],
});
