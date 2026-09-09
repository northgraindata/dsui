import { ResourceTree } from "@northgraindata/dsui-adapter-sdk";
import { databases, relations, schemas } from "../resources/catalog.js";

export function dataExplorer(selectedPath: string) {
  return ResourceTree({
    label: "Data explorer",
    stateKey: "duckdb-data-explorer",
    selectedPath,
    searchPlaceholder: "Search databases, schemas, and objects…",
    branch: {
      source: databases(),
      nameField: "name",
      rowLink: {
        path: "/data/:database",
        params: { database: "name" },
      },
      children: {
        source: schemas({ database: "$name" }),
        nameField: "name",
        rowLink: {
          path: "/data/:database/:schema",
          params: { database: "database", schema: "name" },
        },
        children: {
          source: relations({
            database: "$database",
            schema: "$name",
            type: "all",
          }),
          nameField: "name",
          typeField: "type",
          rowLink: {
            path: "/data/:database/:schema/:relationType/:relation",
            params: {
              database: "database",
              schema: "schema",
              relationType: "relationType",
              relation: "relation",
            },
          },
        },
      },
    },
  });
}
