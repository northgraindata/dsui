import {
  Button,
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
            link: "/connections/new",
            variant: "primary",
          }),
        }),
        Table({
          source: connections(),
          searchable: true,
          pageSize: 25,
          columns: [
            { id: "connectionId", label: "Connection ID" },
            { id: "connectionType", label: "Type" },
            { id: "host", label: "Host" },
            { id: "login", label: "Login" },
            { id: "description", label: "Description" },
          ],
          rowActions: [
            {
              label: "Edit",
              link: {
                path: "/connections/:connectionId/edit?connectionType=:connectionType&host=:host&login=:login&schema=:schema&port=:port&description=:description",
                params: {
                  connectionId: "connectionId",
                  connectionType: "connectionType",
                  host: "host",
                  login: "login",
                  schema: "schema",
                  port: "port",
                  description: "description",
                },
              },
            },
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
      ],
    }),
});

export const createConnectionPage = definePage({
  path: "/connections/new",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Add connection",
          description:
            "Create a connection record in the connected Airflow instance.",
          actions: Button({
            label: "Back to connections",
            link: "/connections",
          }),
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

export const editConnectionPage = definePage({
  path: "/connections/:connectionId/edit",
  render: ({ params, query }) =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: `Edit connection ${params.connectionId}`,
          actions: Button({
            label: "Back to connections",
            link: "/connections",
          }),
        }),
        Form({
          schema: createConnectionInput,
          fields: [
            TextInput({
              name: "connectionId",
              label: "Connection ID",
              value: params.connectionId,
            }),
            TextInput({
              name: "connectionType",
              label: "Connection type",
              value: query.get("connectionType") ?? "",
            }),
            TextInput({
              name: "host",
              label: "Host",
              value: query.get("host") ?? "",
            }),
            TextInput({
              name: "login",
              label: "Login",
              value: query.get("login") ?? "",
            }),
            TextInput({
              name: "password",
              label: "New password (optional)",
              secret: true,
            }),
            TextInput({
              name: "schema",
              label: "Schema",
              value: query.get("schema") ?? "",
            }),
            TextInput({
              name: "port",
              label: "Port",
              value: query.get("port") ?? "",
            }),
            TextInput({ name: "extra", label: "Extra (JSON)" }),
            TextInput({
              name: "description",
              label: "Description",
              value: query.get("description") ?? "",
            }),
          ],
          onSubmit: updateConnection,
          submitLabel: "Save connection",
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
            link: "/variables/new",
            variant: "primary",
          }),
        }),
        Table({
          source: variables(),
          searchable: true,
          pageSize: 25,
          columns: [
            { id: "key", label: "Key" },
            { id: "description", label: "Description" },
            { id: "isEncrypted", label: "Encrypted" },
          ],
          rowActions: [
            {
              label: "Edit",
              link: {
                path: "/variables/:key/edit?description=:description",
                params: { key: "key", description: "description" },
              },
            },
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
      ],
    }),
});

export const createVariablePage = definePage({
  path: "/variables/new",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Add variable",
          description: "Create a variable in the connected Airflow instance.",
          actions: Button({ label: "Back to variables", link: "/variables" }),
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

export const editVariablePage = definePage({
  path: "/variables/:key/edit",
  render: ({ params, query }) =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: `Edit variable ${params.key}`,
          description:
            "Set a replacement value; Airflow does not return existing variable values.",
          actions: Button({ label: "Back to variables", link: "/variables" }),
        }),
        Form({
          schema: createVariableInput,
          fields: [
            TextInput({ name: "key", label: "Key", value: params.key }),
            TextInput({
              name: "value",
              label: "Replacement value",
              secret: true,
            }),
            TextInput({
              name: "description",
              label: "Description",
              value: query.get("description") ?? "",
            }),
          ],
          onSubmit: updateVariable,
          submitLabel: "Save variable",
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
            link: "/pools/new",
            variant: "primary",
          }),
        }),
        Table({
          source: pools(),
          searchable: true,
          pageSize: 25,
          columns: [
            { id: "name", label: "Pool" },
            { id: "slots", label: "Slots" },
            { id: "occupiedSlots", label: "Occupied" },
            { id: "openSlots", label: "Open" },
            { id: "description", label: "Description" },
          ],
          rowActions: [
            {
              label: "Edit",
              link: {
                path: "/pools/:name/edit?slots=:slots&description=:description",
                params: {
                  name: "name",
                  slots: "slots",
                  description: "description",
                },
              },
            },
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
      ],
    }),
});

export const createPoolPage = definePage({
  path: "/pools/new",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Add pool",
          description:
            "Create a concurrency pool in the connected Airflow instance.",
          actions: Button({ label: "Back to pools", link: "/pools" }),
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

export const editPoolPage = definePage({
  path: "/pools/:name/edit",
  render: ({ params, query }) =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: `Edit pool ${params.name}`,
          actions: Button({ label: "Back to pools", link: "/pools" }),
        }),
        Form({
          schema: createPoolInput,
          fields: [
            TextInput({ name: "name", label: "Pool name", value: params.name }),
            TextInput({
              name: "slots",
              label: "Slots",
              value: query.get("slots") ?? "",
            }),
            TextInput({
              name: "description",
              label: "Description",
              value: query.get("description") ?? "",
            }),
          ],
          onSubmit: updatePool,
          submitLabel: "Save pool",
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
          searchable: true,
          pageSize: 25,
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
          source: eventLogs(),
          searchable: true,
          pageSize: 25,
          columns: [
            { id: "timestamp", label: "Time" },
            { id: "event", label: "Event" },
            { id: "dagId", label: "DAG" },
            { id: "taskId", label: "Task" },
            { id: "owner", label: "User" },
          ],
        }),
      ],
    }),
});
