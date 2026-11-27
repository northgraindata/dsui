import {
  definePage,
  KeyValue,
  List,
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
    List({
      source: assets({}),
      paged: { search: "Search assets" },
      noun: "asset",
      item: {
        icon: "layers",
        title: "name",
        badge: "group",
        description: "uri",
        meta: ["producerLabel", "updatedLabel"],
      },
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
              paged: {},
              columns: [
                { id: "timestamp", label: "Timestamp", format: "datetime" },
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
