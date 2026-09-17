import {
  definePage,
  PageHeader,
  QueryEditor,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../actions/run-query.js";
import {
  databaseRelations,
  databaseSchemas,
  databases,
} from "../resources/catalog.js";

export const queryPage = definePage({
  path: "/query",
  render: () => [
    PageHeader({
      title: "Query editor",
      description:
        "Run bounded SQL statements against the configured database.",
    }),
    QueryEditor({
      language: "sql",
      action: runQuery,
      database: { source: databases() },
      explorer: {
        source: databases(),
        children: {
          source: databaseSchemas({ database: "$name" }),
          children: {
            source: databaseRelations({
              database: "$database",
              schema: "$name",
            }),
          },
        },
      },
    }),
  ],
});

export const databaseQueryPage = definePage({
  path: "/query/:database",
  render: ({ params }) => [
    PageHeader({
      title: `Query editor · ${params.database}`,
      description: `Run bounded SQL statements against ${params.database}. Use schema.table names; PostgreSQL databases cannot be referenced from SQL.`,
    }),
    QueryEditor({
      language: "sql",
      action: runQuery({ database: params.database }),
      database: {
        source: databases(),
        initialValue: params.database,
      },
      explorer: {
        source: databases(),
        children: {
          source: databaseSchemas({ database: "$name" }),
          children: {
            source: databaseRelations({
              database: "$database",
              schema: "$name",
            }),
          },
        },
      },
    }),
  ],
});
