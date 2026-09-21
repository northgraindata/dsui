import { ResourceTree } from "@northgraindata/dsui-adapter-sdk";
import {
  databaseRelations,
  databaseSchemas,
  databases,
} from "../resources/catalog.js";

export function dataExplorer(selectedPath: string) {
  return ResourceTree({
    label: "Data explorer",
    stateKey: "postgresql-data-explorer",
    selectedPath,
    searchPlaceholder: "Search schemas, tables, columns...",
    branch: {
      source: databases(),
      nameField: "name",
      rowLink: {
        path: "/data/:database",
        params: { database: "name" },
      },
      children: {
        source: databaseSchemas({ database: "$name" }),
        nameField: "name",
        rowLink: {
          path: "/data/:database/:schema",
          params: { database: "database", schema: "name" },
        },
        children: {
          source: databaseRelations({
            database: "$database",
            schema: "$name",
          }),
          nameField: "name",
          typeField: "kind",
          rowLink: {
            path: "/data/:database/:schema/:relation",
            params: {
              database: "database",
              schema: "schema",
              relation: "name",
            },
          },
        },
      },
    },
  });
}
