import {
  defineComponent,
  definePage,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";

const Detail = defineComponent<{ view: "worker"; nodeId: string }>({
  id: "trino/detail",
  path: "../browser.tsx",
});
export const workerPage = definePage({
  path: "/workers/:nodeId",
  render: ({ params }) => [
    PageHeader({
      title: "Worker",
      description: params.nodeId,
      variant: "detail",
    }),
    Detail({ view: "worker", nodeId: params.nodeId }),
  ],
});
