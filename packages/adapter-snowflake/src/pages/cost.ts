import {
  Button,
  definePage,
  PageHeader,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { resumeMonitor, suspendMonitor } from "../actions/cost.js";
import type { BudgetInfo, CostRow, MonitorInfo } from "../context.js";
import { budgets, monitors, warehouseSpend } from "../resources/cost.js";

export const costPage = definePage({
  path: "/cost",
  render: () => [
    PageHeader({ title: "Cost management" }),
    Tabs({
      items: [
        {
          label: "Warehouse spend",
          content: Table<CostRow>({ source: warehouseSpend({ days: 7 }) }),
        },
        {
          label: "Budgets",
          content: Table<BudgetInfo>({ source: budgets() }),
        },
        {
          label: "Monitors",
          content: Table<MonitorInfo>({
            source: monitors(),
            actions: (row) =>
              row.status === "ACTIVE"
                ? Button({
                    label: "Suspend",
                    action: suspendMonitor({ name: row.name }),
                  })
                : Button({
                    label: "Resume",
                    action: resumeMonitor({ name: row.name }),
                  }),
          }),
        },
      ],
    }),
  ],
});
