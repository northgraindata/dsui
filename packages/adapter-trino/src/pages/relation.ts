import {
  definePage,
  PageHeader,
  SplitPane,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import {
  relationColumns,
  relationDdl,
  relationPreview,
  relationStats,
} from "../resources/index.js";
export const relationPage = definePage({
  path: "/explorer/:catalog/:schema/:name/:type",
  render: ({ params }) => {
    const kindByType: Record<string, "view" | "materialized-view" | "table"> = {
      VIEW: "view",
      "MATERIALIZED VIEW": "materialized-view",
    };
    const kind = kindByType[params.type] ?? "table";
    const input = {
      catalog: params.catalog,
      schema: params.schema,
      name: params.name,
      kind,
    };
    return SplitPane({
      sidebar: dataExplorer(
        `/explorer/${encodeURIComponent(params.catalog)}/${encodeURIComponent(params.schema)}/${encodeURIComponent(params.name)}/${encodeURIComponent(params.type)}`,
      ),
      content: [
        PageHeader({
          title: params.name,
          description: `${params.catalog} / ${params.schema} / ${params.type}`,
          variant: "detail",
        }),
        Tabs({
          items: [
            {
              label: "Preview",
              content: Table({
                variant: "data",
                source: relationPreview(input),
                pageSize: 25,
              }),
            },
            {
              label: "Columns",
              content: Table({
                source: relationColumns(input),
                searchable: true,
              }),
            },
            {
              label: "Statistics",
              content: Table({ source: relationStats(input) }),
            },
            { label: "DDL", content: Table({ source: relationDdl(input) }) },
          ],
        }),
      ],
    });
  },
});
