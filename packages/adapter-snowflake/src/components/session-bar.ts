import {
  defineComponent,
  type PageNode,
  Select,
} from "@northgraindata/dsui-adapter-sdk";

/**
 * Global Snowflake session bar: role / warehouse / database / schema
 * selectors bound to the adapter-scoped session store. Pages opt in by
 * rendering it with live store state and actions.
 */
export interface SessionBarProps {
  role: string | null;
  warehouse: string | null;
  database: string | null;
  schema: string | null;
  roles: readonly string[];
  warehouses: readonly string[];
  databases: readonly string[];
  onRole: (role: string | null) => void;
  onWarehouse: (warehouse: string | null) => void;
  onDatabase: (database: string | null) => void;
  onSchema: (schema: string | null) => void;
}

const options = (values: readonly string[]) =>
  values.map((value) => ({ label: value, value }));

export const SessionBar = defineComponent<SessionBarProps, readonly PageNode[]>(
  {
    id: "session-bar",
    render: (props) => [
      Select({
        name: "role",
        label: "Role",
        value: props.role,
        options: options(props.roles),
        onChange: props.onRole,
      }),
      Select({
        name: "warehouse",
        label: "Warehouse",
        value: props.warehouse,
        options: options(props.warehouses),
        onChange: props.onWarehouse,
      }),
      Select({
        name: "database",
        label: "Database",
        value: props.database,
        options: options(props.databases),
        onChange: props.onDatabase,
      }),
      Select({
        name: "schema",
        label: "Schema",
        value: props.schema,
        options: [],
        onChange: props.onSchema,
      }),
    ],
  },
);
