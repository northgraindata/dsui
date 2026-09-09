import {
  definePage,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { resumeMonitor, suspendMonitor } from "../actions/cost.js";
import { budgets, monitors, warehouseSpend } from "../resources/cost.js";

export const costPage = definePage({
  path: "/cost",
  render: () => [
    PageHeader({ title: "Cost management" }),
    Tabs({
      items: [
        {
          label: "Warehouse spend",
          content: Table({ source: warehouseSpend({ days: 7 }) }),
        },
        {
          label: "Budgets",
          content: Table({ source: budgets() }),
        },
        {
          label: "Monitors",
          content: Table({
            source: monitors(),
            rowActions: [
              {
                label: "Suspend",
                action: suspendMonitor,
                input: { name: "name" },
                when: { field: "status", equals: "ACTIVE" },
              },
              {
                label: "Resume",
                action: resumeMonitor,
                input: { name: "name" },
                when: { field: "status", notEquals: "ACTIVE" },
              },
            ],
          }),
        },
      ],
    }),
  ],
});
