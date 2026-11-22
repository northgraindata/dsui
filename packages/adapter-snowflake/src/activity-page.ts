import {
  Button,
  CodeBlock,
  Collection,
  definePage,
  KeyValue,
  PageHeader,
  Stack,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { activity, queryDetail, queryText } from "./resources.js";

export const activityPage = definePage({
  path: "/activity",
  render: () => [
    PageHeader({
      title: "Activity",
      description:
        "Recent queries for the current user, refreshed every few seconds.",
    }),
    Table({
      source: activity(),
      columns: [
        { id: "status", label: "Status" },
        { id: "user", label: "User" },
        { id: "warehouse", label: "Warehouse" },
        { id: "startedAt", label: "Started" },
        { id: "elapsed", label: "Elapsed" },
        { id: "text", label: "Query" },
      ],
      filters: [
        {
          field: "status",
          label: "Status",
          options: [
            { label: "Running", value: "RUNNING" },
            { label: "Queued", value: "QUEUED" },
            { label: "Succeeded", value: "SUCCESS" },
            { label: "Failed", value: "FAILED_WITH_ERROR" },
          ],
        },
      ],
      rowLink: { path: "/activity/:queryId", params: { queryId: "queryId" } },
      rowActions: [
        {
          label: "Cancel",
          variant: "danger",
          action: "cancel-query",
          input: { queryId: "queryId" },
          when: { field: "canCancel", equals: 1 },
          confirmation: {
            title: "Cancel query?",
            description: "Ask Snowflake to cancel this running statement.",
            confirmLabel: "Cancel query",
          },
        },
      ],
      searchable: true,
      pageSize: 50,
    }),
  ],
});

export const queryDetailPage = definePage({
  path: "/activity/:queryId",
  render: ({ params }) => {
    const input = { queryId: params.queryId };
    return [
      PageHeader({
        title: "Query",
        description: params.queryId,
      }),
      Stack({
        gap: "md",
        content: [
          Button({
            variant: "secondary",
            label: "Back to activity",
            icon: "chevron",
            link: "/activity",
          }),
          KeyValue({ title: "Details", source: queryDetail(input) }),
          Collection({
            source: queryText(input),
            content: CodeBlock({
              label: "SQL",
              language: "sql",
              value: { field: "text" },
            }),
          }),
        ],
      }),
    ];
  },
});
