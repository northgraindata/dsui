import { ResourceTree } from "@northgraindata/dsui-adapter-sdk";
import { catalogs, relations, schemas } from "../resources/index.js";

export function dataExplorer(selectedPath: string) {
  return ResourceTree({
    label: "Data explorer",
    stateKey: "trino-data-explorer",
    selectedPath,
    searchPlaceholder: "Search schemas, tables, columns...",
    branch: {
      source: catalogs(),
      nameField: "name",
      rowLink: {
        path: "/explorer/:catalog",
        params: { catalog: "name" },
      },
      children: {
        source: schemas({ catalog: "$name" }),
        nameField: "name",
        rowLink: {
          path: "/explorer/:catalog/:schema",
          params: { catalog: "catalog", schema: "name" },
        },
        children: {
          source: relations({ catalog: "$catalog", schema: "$name" }),
          nameField: "name",
          typeField: "type",
          rowLink: {
            path: "/explorer/:catalog/:schema/:name/:type",
            params: {
              catalog: "catalog",
              schema: "schema",
              name: "name",
              type: "type",
            },
          },
        },
      },
    },
  });
}
