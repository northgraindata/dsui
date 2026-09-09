import {
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { resumeComputePool, suspendComputePool } from "../actions/compute.js";
import { computePools } from "../resources/compute.js";

export const poolsPage = definePage({
  path: "/compute-pools",
  render: () => [
    PageHeader({ title: "Compute pools" }),
    Table({
      source: computePools(),
      rowActions: [
        {
          label: "Suspend",
          action: suspendComputePool,
          input: { name: "name" },
          when: { field: "status", equals: "ACTIVE" },
        },
        {
          label: "Resume",
          action: resumeComputePool,
          input: { name: "name" },
          when: { field: "status", notEquals: "ACTIVE" },
        },
      ],
    }),
  ],
});
