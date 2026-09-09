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
    PageHeader({ title: "Assets" }),
    Table({
      source: assets(),
      rowLink: { path: "/assets/:assetId", params: { assetId: "assetId" } },
    }),
  ],
});

export const assetDetailPage = definePage({
  path: "/assets/:assetId",
  render: ({ params }) => {
    const input = { assetId: Number(params.assetId) };
    return [
      PageHeader({ title: `Asset ${params.assetId}` }),
      Tabs({
        items: [
          {
            label: "Details",
            content: KeyValue({ source: assetDetails(input) }),
          },
          {
            label: "Events",
            content: Table({ source: assetEvents(input) }),
          },
        ],
      }),
    ];
  },
});
