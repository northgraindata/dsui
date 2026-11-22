import {
  Button,
  Chart,
  Columns,
  definePage,
  Form,
  KeyValue,
  PageHeader,
  Section,
  Select,
  Stack,
  Table,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  autoSuspendInput,
  resizeWarehouse,
  resizeWarehouseInput,
  resumeWarehouse,
  setWarehouseAutoSuspend,
  suspendWarehouse,
} from "./actions.js";
import { WAREHOUSE_SIZES } from "./client.js";
import { warehouseDetail, warehouseLoad, warehouses } from "./resources.js";

const sizeOptions = WAREHOUSE_SIZES.map((size) => ({
  label: size,
  value: size,
}));

export const warehousesPage = definePage({
  path: "/warehouses",
  render: () => [
    PageHeader({
      title: "Warehouses",
      description: "Compute available to the current Snowflake role.",
    }),
    Table({
      source: warehouses(),
      columns: [
        { id: "name", label: "Name" },
        { id: "size", label: "Size" },
        { id: "state", label: "Status" },
        { id: "running", label: "Running" },
        { id: "queued", label: "Queued" },
        { id: "autoSuspend", label: "Auto suspend (s)" },
      ],
      filters: [
        {
          field: "state",
          label: "Status",
          options: [
            { label: "Started", value: "STARTED" },
            { label: "Suspended", value: "SUSPENDED" },
            { label: "Resuming", value: "RESUMING" },
          ],
        },
        { field: "size", label: "Size", options: sizeOptions },
      ],
      rowLink: { path: "/warehouses/:name", params: { name: "name" } },
      rowActions: [
        {
          label: "Suspend",
          variant: "danger",
          action: "suspend-warehouse",
          input: { warehouse: "name" },
          when: { field: "state", equals: "STARTED" },
          confirmation: {
            title: "Suspend warehouse?",
            description:
              "Running queries on this warehouse may be interrupted.",
            confirmLabel: "Suspend",
          },
        },
        {
          label: "Resume",
          variant: "secondary",
          action: "resume-warehouse",
          input: { warehouse: "name" },
          when: { field: "state", equals: "SUSPENDED" },
        },
      ],
      searchable: true,
    }),
  ],
});

export const warehouseDetailPage = definePage({
  path: "/warehouses/:name",
  render: ({ params }) => {
    const warehouse = params.name;
    return [
      PageHeader({
        title: warehouse,
        description: "Warehouse configuration, load, and controls.",
      }),
      Stack({
        gap: "md",
        content: [
          Stack({
            gap: "sm",
            content: [
              Button({
                label: "Resume",
                variant: "primary",
                icon: "play",
                action: resumeWarehouse({ warehouse }),
              }),
              Button({
                label: "Suspend",
                variant: "danger",
                action: suspendWarehouse({ warehouse }),
                confirmation: {
                  title: "Suspend warehouse?",
                  description: `Running queries on ${warehouse} may be interrupted.`,
                  confirmLabel: "Suspend",
                },
              }),
              Button({
                label: "Back to warehouses",
                variant: "secondary",
                link: "/warehouses",
              }),
            ],
          }),
          KeyValue({
            title: "Configuration",
            source: warehouseDetail({ warehouse }),
          }),
          Columns({
            columns: [
              {
                weight: 1,
                content: Section({
                  title: "Running queries",
                  description: "Average per 5 minutes, last 24 hours.",
                  content: Chart({
                    source: warehouseLoad({ warehouse, metric: "running" }),
                    kind: "area",
                    label: `Running queries on ${warehouse}`,
                  }),
                }),
              },
              {
                weight: 1,
                content: Section({
                  title: "Queued queries",
                  description: "Average queued load per 5 minutes.",
                  content: Chart({
                    source: warehouseLoad({ warehouse, metric: "queued" }),
                    kind: "area",
                    label: `Queued queries on ${warehouse}`,
                  }),
                }),
              },
            ],
          }),
          Section({
            title: "Resize",
            content: Form({
              schema: resizeWarehouseInput,
              fields: [
                TextInput({
                  name: "warehouse",
                  label: "Warehouse",
                  value: warehouse,
                }),
                Select({ name: "size", label: "Size", options: sizeOptions }),
              ],
              onSubmit: resizeWarehouse,
              submitLabel: "Resize warehouse",
            }),
          }),
          Section({
            title: "Auto suspend",
            content: Form({
              schema: autoSuspendInput,
              fields: [
                TextInput({
                  name: "warehouse",
                  label: "Warehouse",
                  value: warehouse,
                }),
                TextInput({
                  name: "seconds",
                  label: "Idle seconds (0 = never)",
                }),
              ],
              onSubmit: setWarehouseAutoSuspend,
              submitLabel: "Update auto suspend",
            }),
          }),
        ],
      }),
    ];
  },
});
