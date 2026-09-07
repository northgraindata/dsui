import {
  Button,
  definePage,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { resumeComputePool, suspendComputePool } from "../actions/compute.js";
import type { ComputePoolInfo } from "../context.js";
import { computePools } from "../resources/compute.js";

export const poolsPage = definePage({
  path: "/compute-pools",
  render: () => [
    PageHeader({ title: "Compute pools" }),
    Table<ComputePoolInfo>({
      source: computePools(),
      actions: (row) =>
        row.status === "ACTIVE"
          ? Button({
              label: "Suspend",
              action: suspendComputePool({ name: row.name }),
            })
          : Button({
              label: "Resume",
              action: resumeComputePool({ name: row.name }),
            }),
    }),
  ],
});
