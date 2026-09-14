import {
  definePage,
  Form,
  PageHeader,
  Stack,
  Table,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  createConnection,
  createConnectionInput,
  createPool,
  createPoolInput,
  createVariable,
  createVariableInput,
  deleteConnection,
  deletePool,
  deleteVariable,
} from "../actions/admin.js";
import { connections, pools, users, variables } from "../resources/admin.js";

export const connectionsPage = definePage({
  path: "/connections",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Connections",
          description:
            "Manage connection records in the connected Airflow instance.",
        }),
        Table({
          source: connections(),
          columns: [
            { id: "connectionId", label: "Connection ID" },
            { id: "connectionType", label: "Type" },
            { id: "host", label: "Host" },
            { id: "login", label: "Login" },
            { id: "description", label: "Description" },
          ],
          rowActions: [
            {
              label: "Delete",
              variant: "danger",
              action: deleteConnection,
              input: { connectionId: "connectionId" },
              confirmation: {
                title: "Delete connection?",
                description: "DAGs using this connection may fail.",
                confirmLabel: "Delete",
              },
            },
          ],
        }),
        Form({
          schema: createConnectionInput,
          fields: [
            TextInput({ name: "connectionId", label: "Connection ID" }),
            TextInput({ name: "connectionType", label: "Connection type" }),
            TextInput({ name: "host", label: "Host" }),
            TextInput({ name: "login", label: "Login" }),
            TextInput({ name: "password", label: "Password", secret: true }),
            TextInput({ name: "schema", label: "Schema" }),
            TextInput({ name: "port", label: "Port" }),
            TextInput({ name: "extra", label: "Extra (JSON)" }),
            TextInput({ name: "description", label: "Description" }),
          ],
          onSubmit: createConnection,
          submitLabel: "Create connection",
        }),
      ],
    }),
});

export const variablesPage = definePage({
  path: "/variables",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Variables",
          description:
            "Manage values stored by the connected Airflow instance.",
        }),
        Table({
          source: variables(),
          columns: [
            { id: "key", label: "Key" },
            { id: "description", label: "Description" },
            { id: "isEncrypted", label: "Encrypted" },
          ],
          rowActions: [
            {
              label: "Delete",
              variant: "danger",
              action: deleteVariable,
              input: { key: "key" },
              confirmation: {
                title: "Delete variable?",
                description: "This cannot be undone.",
                confirmLabel: "Delete",
              },
            },
          ],
        }),
        Form({
          schema: createVariableInput,
          fields: [
            TextInput({ name: "key", label: "Key" }),
            TextInput({ name: "value", label: "Value", secret: true }),
            TextInput({ name: "description", label: "Description" }),
          ],
          onSubmit: createVariable,
          submitLabel: "Create variable",
        }),
      ],
    }),
});

export const poolsPage = definePage({
  path: "/pools",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Pools",
          description:
            "Control concurrency pools in the connected Airflow instance.",
        }),
        Table({
          source: pools(),
          columns: [
            { id: "name", label: "Pool" },
            { id: "slots", label: "Slots" },
            { id: "occupiedSlots", label: "Occupied" },
            { id: "openSlots", label: "Open" },
            { id: "description", label: "Description" },
          ],
          rowActions: [
            {
              label: "Delete",
              variant: "danger",
              action: deletePool,
              input: { name: "name" },
              confirmation: {
                title: "Delete pool?",
                description: "Tasks assigned to this pool may stop scheduling.",
                confirmLabel: "Delete",
              },
            },
          ],
        }),
        Form({
          schema: createPoolInput,
          fields: [
            TextInput({ name: "name", label: "Pool name" }),
            TextInput({ name: "slots", label: "Slots" }),
            TextInput({ name: "description", label: "Description" }),
          ],
          onSubmit: createPool,
          submitLabel: "Create pool",
        }),
      ],
    }),
});

export const usersPage = definePage({
  path: "/users",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Users & roles",
          description:
            "Airflow 2.1 uses its legacy user API. Airflow 3 delegates identities and roles to its configured auth manager.",
        }),
        Table({
          source: users(),
          columns: [
            { id: "username", label: "User" },
            { id: "name", label: "Name" },
            { id: "email", label: "Email" },
            { id: "active", label: "Active" },
            { id: "roles", label: "Roles" },
          ],
        }),
      ],
    }),
});
