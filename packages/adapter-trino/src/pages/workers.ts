import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { workerNodes } from "../resources/index.js";

export const workersPage = definePage({
  path: "/workers",
  render: () => [
    PageHeader({
      title: "Workers",
      description: "Coordinator and worker nodes registered with Trino.",
    }),
    Table({
      source: workerNodes(),
      columns: [
        { id: "nodeId", label: "Node ID" },
        { id: "coordinator", label: "Coordinator" },
        { id: "nodeVersion", label: "Version" },
        { id: "state", label: "State" },
        { id: "uri", label: "Address" },
      ],
      searchable: true,
      pageSize: 25,
      rowLink: { path: "/workers/:nodeId", params: { nodeId: "nodeId" } },
    }),
  ],
});
