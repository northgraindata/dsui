import {
  defineComponent,
  definePage,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";

const Detail = defineComponent<{ view: "query"; queryId: string }>({
  id: "trino/detail",
  path: "../browser.tsx",
});
export const queryDetailsPage = definePage({
  path: "/activity/:queryId",
  render: ({ params }) => [
    PageHeader({
      title: "Query details",
      description: params.queryId,
      variant: "detail",
    }),
    Detail({ view: "query", queryId: params.queryId }),
  ],
});
