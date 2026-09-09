import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { queries, queryDetails, queryResults } from "../resources/queries.js";
import { queryFiltersStore } from "../stores/query-filters.js";

export const queryHistoryPage = definePage({
  path: "/queries",
  stores: [queryFiltersStore],
  render: ({ stores }) => {
    const filters = stores.use(queryFiltersStore);
    return [
      PageHeader({ title: "Query history" }),
      Table({
        source: queries({
          warehouse: filters.warehouse,
          status: filters.status,
          search: filters.search,
        }),
        rowLink: { path: "/queries/:queryId", params: { queryId: "id" } },
      }),
    ];
  },
});

export const queryDetailPage = definePage({
  path: "/queries/:queryId",
  render: ({ params }) => [
    PageHeader({ title: params.queryId }),
    Tabs({
      items: [
        {
          label: "Details",
          content: KeyValue({
            source: queryDetails({ queryId: params.queryId }),
          }),
        },
        {
          label: "Results",
          content: Table({
            source: queryResults({ queryId: params.queryId }),
          }),
        },
      ],
    }),
  ],
});
