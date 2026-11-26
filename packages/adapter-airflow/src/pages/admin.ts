import {
  Button,
  definePage,
  Form,
  List,
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
  updateConnection,
  updatePool,
  updateVariable,
} from "../actions/admin.js";
import {
  connections,
  eventLogs,
  pools,
  users,
  variables,
} from "../resources/admin.js";

/* The create and edit forms, shown in modals over their lists. */
const newConnection = Form({
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
});

const connectionEditor = Form({
  schema: createConnectionInput,
  fields: [
    TextInput({
      name: "connectionId",
      label: "Connection ID",
      value: { field: "connectionId" },
    }),
    TextInput({
      name: "connectionType",
      label: "Connection type",
      value: { field: "connectionType" },
    }),
    TextInput({
      name: "host",
      label: "Host",
      value: { field: "host" },
    }),
    TextInput({
      name: "login",
      label: "Login",
      value: { field: "login" },
    }),
    TextInput({
      name: "password",
      label: "New password (optional)",
      secret: true,
    }),
    TextInput({
      name: "schema",
      label: "Schema",
      value: { field: "schema" },
    }),
    TextInput({
      name: "port",
      label: "Port",
      value: { field: "port" },
    }),
    TextInput({ name: "extra", label: "Extra (JSON)" }),
    TextInput({
      name: "description",
      label: "Description",
      value: { field: "description" },
    }),
  ],
  onSubmit: updateConnection,
  submitLabel: "Save connection",
});

const newVariable = Form({
  schema: createVariableInput,
  fields: [
    TextInput({ name: "key", label: "Key" }),
    TextInput({ name: "value", label: "Value", secret: true }),
    TextInput({ name: "description", label: "Description" }),
  ],
  onSubmit: createVariable,
  submitLabel: "Create variable",
});

const variableEditor = Form({
  schema: createVariableInput,
  fields: [
    TextInput({ name: "key", label: "Key", value: { field: "key" } }),
    TextInput({
      name: "value",
      label: "Replacement value",
      secret: true,
    }),
    TextInput({
      name: "description",
      label: "Description",
      value: { field: "description" },
    }),
  ],
  onSubmit: updateVariable,
  submitLabel: "Save variable",
});

const newPool = Form({
  schema: createPoolInput,
  fields: [
    TextInput({ name: "name", label: "Pool name" }),
    TextInput({ name: "slots", label: "Slots" }),
    TextInput({ name: "description", label: "Description" }),
  ],
  onSubmit: createPool,
  submitLabel: "Create pool",
});

const poolEditor = Form({
  schema: createPoolInput,
  fields: [
    TextInput({ name: "name", label: "Pool name", value: { field: "name" } }),
    TextInput({
      name: "slots",
      label: "Slots",
      value: { field: "slots" },
    }),
    TextInput({
      name: "description",
      label: "Description",
      value: { field: "description" },
    }),
  ],
  onSubmit: updatePool,
  submitLabel: "Save pool",
});

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
          actions: Button({
            label: "Add connection",
            dialog: {
              title: "Add connection",
              description:
                "Create a connection record in the connected Airflow instance.",
              content: newConnection,
            },
            variant: "primary",
          }),
        }),
        List({
          source: connections({}),
          paged: { search: "Search by connection ID" },
          noun: "connection",
          item: {
            icon: "plug",
            title: "connectionId",
            badge: "connectionType",
            description: "description",
            meta: ["address"],
          },
          rowActions: [
            {
              label: "Edit",
              icon: "edit",
              dialog: {
                title: "Edit connection {connectionId}",
                content: connectionEditor,
              },
            },
            {
              label: "Delete",
              icon: "close",
              variant: "danger",
              action: deleteConnection,
              input: { connectionId: "connectionId" },
              confirmation: {
                title: "Delete connection {connectionId}?",
                description: "DAGs using this connection may fail.",
                confirmLabel: "Delete connection",
              },
            },
          ],
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
          actions: Button({
            label: "Add variable",
            dialog: {
              title: "Add variable",
              description:
                "Create a variable in the connected Airflow instance.",
              content: newVariable,
            },
            variant: "primary",
          }),
        }),
        List({
          source: variables({}),
          paged: { search: "Search by key" },
          noun: "variable",
          item: {
            icon: "braces",
            title: "key",
            badge: "encryptedLabel",
            description: "description",
          },
          rowActions: [
            {
              label: "Edit",
              icon: "edit",
              dialog: {
                title: "Edit variable {key}",
                description:
                  "Airflow does not return existing values, so enter a replacement.",
                content: variableEditor,
              },
            },
            {
              label: "Delete",
              icon: "close",
              variant: "danger",
              action: deleteVariable,
              input: { key: "key" },
              confirmation: {
                title: "Delete variable {key}?",
                description: "This cannot be undone.",
                confirmLabel: "Delete variable",
              },
            },
          ],
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
          actions: Button({
            label: "Add pool",
            dialog: {
              title: "Add pool",
              description:
                "Create a concurrency pool in the connected Airflow instance.",
              content: newPool,
            },
            variant: "primary",
          }),
        }),
        List({
          source: pools({}),
          paged: { search: "Search by pool name" },
          noun: "pool",
          item: {
            icon: "layers",
            title: "name",
            description: "description",
            meta: ["usageLabel"],
            status: { label: "openLabel", tone: "openTone" },
          },
          rowActions: [
            {
              label: "Edit",
              icon: "edit",
              dialog: {
                title: "Edit pool {name}",
                content: poolEditor,
              },
            },
            {
              label: "Delete",
              icon: "close",
              variant: "danger",
              action: deletePool,
              input: { name: "name" },
              confirmation: {
                title: "Delete pool {name}?",
                description: "Tasks assigned to this pool may stop scheduling.",
                confirmLabel: "Delete pool",
              },
            },
          ],
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
        List({
          source: users({}),
          paged: {},
          noun: "user",
          item: {
            icon: "user",
            title: "username",
            badge: "roles",
            description: "name",
            meta: ["email"],
            status: { label: "statusLabel", tone: "statusTone" },
          },
        }),
      ],
    }),
});

export const eventLogsPage = definePage({
  path: "/event-logs",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Event log",
          description:
            "Audit events recorded by the connected Airflow instance.",
        }),
        Table({
          source: eventLogs({}),
          paged: { search: "Search by DAG ID" },
          columns: [
            { id: "timestamp", label: "Time", format: "datetime" },
            { id: "event", label: "Event" },
            { id: "dagId", label: "DAG" },
            { id: "taskId", label: "Task" },
            { id: "owner", label: "User" },
          ],
        }),
      ],
    }),
});
