import {
  definePage,
  Form,
  KeyValue,
  PageHeader,
  Select,
  Table,
  Tabs,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  createWarehouse,
  createWarehouseInput,
  resizeWarehouse,
  resizeWarehouseInput,
  resumeWarehouse,
  suspendWarehouse,
} from "../actions/warehouses.js";
import { queries } from "../resources/queries.js";
import { warehouseDetails, warehouses } from "../resources/warehouses.js";

const WAREHOUSE_SIZES = ["XSMALL", "SMALL", "MEDIUM", "LARGE", "XLARGE"].map(
  (size) => ({ label: size, value: size }),
);

export const warehousesPage = definePage({
  path: "/warehouses",
  render: () => [
    PageHeader({ title: "Warehouses" }),
    Table({
      source: warehouses(),
      rowLink: {
        path: "/warehouses/:warehouse",
        params: { warehouse: "name" },
      },
      rowActions: [
        {
          label: "Resume",
          action: resumeWarehouse,
          input: { warehouse: "name" },
          when: { field: "status", equals: "SUSPENDED" },
        },
        {
          label: "Suspend",
          action: suspendWarehouse,
          input: { warehouse: "name" },
          when: { field: "status", notEquals: "SUSPENDED" },
        },
      ],
    }),
    Form({
      schema: createWarehouseInput,
      fields: [
        TextInput({ name: "name", label: "Name" }),
        Select({ name: "size", label: "Size", options: WAREHOUSE_SIZES }),
      ],
      onSubmit: createWarehouse,
      submitLabel: "Create warehouse",
    }),
    Form({
      schema: resizeWarehouseInput,
      fields: [
        TextInput({ name: "warehouse", label: "Warehouse" }),
        Select({ name: "size", label: "Size", options: WAREHOUSE_SIZES }),
      ],
      onSubmit: resizeWarehouse,
      submitLabel: "Resize warehouse",
    }),
  ],
});

export const warehouseDetailPage = definePage({
  path: "/warehouses/:warehouse",
  render: ({ params }) => [
    PageHeader({ title: params.warehouse }),
    Tabs({
      items: [
        {
          label: "Overview",
          content: KeyValue({
            source: warehouseDetails({ warehouse: params.warehouse }),
          }),
        },
        {
          label: "Queries",
          content: Table({
            source: queries({
              warehouse: params.warehouse,
              status: null,
              search: "",
            }),
          }),
        },
      ],
    }),
  ],
});
