import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { assetDetails, assetEvents, assets } from "../resources/assets.js";

export const assetListPage = definePage({
  path: "/assets",
  render: () => [
    PageHeader({
      title: "Assets",
      description: "Browse Airflow 3 assets or Airflow 2 datasets.",
    }),
    Table({
      source: assets(),
      columns: [
        { id: "name", label: "Asset" },
        { id: "uri", label: "URI" },
        { id: "group", label: "Group" },
        { id: "updatedAt", label: "Updated" },
      ],
      rowLink: { path: "/assets/:assetId", params: { assetId: "assetId" } },
    }),
  ],
});

export const assetDetailPage = definePage({
  path: "/assets/:assetId",
  render: ({ params }) => {
    const input = { assetId: Number(params.assetId) };
    return [
      PageHeader({
        title: `Asset ${params.assetId}`,
        description: "Inspect metadata and recent materialization events.",
      }),
      Tabs({
        items: [
          {
            label: "Details",
            content: KeyValue({
              title: "Asset details",
              source: assetDetails(input),
            }),
          },
          {
            label: "Events",
            content: Table({
              source: assetEvents(input),
              columns: [
                { id: "timestamp", label: "Timestamp" },
                { id: "sourceDagId", label: "Source DAG" },
                { id: "sourceTaskId", label: "Source task" },
                { id: "sourceRunId", label: "Source run" },
              ],
            }),
          },
        ],
      }),
    ];
  },
});
