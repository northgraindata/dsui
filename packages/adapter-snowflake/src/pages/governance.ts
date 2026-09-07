import {
  Button,
  definePage,
  Form,
  KeyValue,
  PageHeader,
  Table,
  Tabs,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import {
  createUser,
  createUserInput,
  grantPrivilege,
  grantPrivilegeInput,
  resumeUser,
  revokePrivilege,
  revokePrivilegeInput,
  suspendUser,
} from "../actions/governance.js";
import type { GrantInfo, RoleInfo, UserInfo } from "../context.js";
import { grants, roles, userDetails, users } from "../resources/governance.js";

export const usersPage = definePage({
  path: "/users",
  render: () => [
    PageHeader({ title: "Users" }),
    Table<UserInfo>({
      source: users(),
      onRowClick: (row) => `/users/${encodeURIComponent(row.name)}`,
      actions: (row) =>
        row.status === "ACTIVE"
          ? Button({
              label: "Suspend",
              action: suspendUser({ name: row.name }),
            })
          : Button({
              label: "Resume",
              action: resumeUser({ name: row.name }),
            }),
    }),
    Form({
      schema: createUserInput,
      fields: [
        TextInput({ name: "name", label: "Name" }),
        TextInput({ name: "password", label: "Password", secret: true }),
      ],
      onSubmit: createUser,
      submitLabel: "Create user",
    }),
  ],
});

export const userDetailPage = definePage({
  path: "/users/:user",
  render: ({ params }) => [
    PageHeader({ title: params.user }),
    KeyValue({ source: userDetails({ user: params.user }) }),
  ],
});

export const rolesPage = definePage({
  path: "/roles",
  render: () => [
    PageHeader({ title: "Roles" }),
    Table<RoleInfo>({ source: roles() }),
  ],
});

const grantFields = [
  TextInput({ name: "privilege", label: "Privilege" }),
  TextInput({ name: "objectType", label: "Object type" }),
  TextInput({ name: "objectName", label: "Object name" }),
];

export const grantsPage = definePage({
  path: "/grants",
  render: () => [
    PageHeader({ title: "Grants" }),
    Tabs({
      items: [
        {
          label: "Privileges",
          content: Table<GrantInfo>({ source: grants() }),
        },
        {
          label: "Grant",
          content: Form({
            schema: grantPrivilegeInput,
            fields: [
              ...grantFields,
              TextInput({ name: "to", label: "To role" }),
            ],
            onSubmit: grantPrivilege,
            submitLabel: "Grant privilege",
          }),
        },
        {
          label: "Revoke",
          content: Form({
            schema: revokePrivilegeInput,
            fields: [
              ...grantFields,
              TextInput({ name: "from", label: "From role" }),
            ],
            onSubmit: revokePrivilege,
            submitLabel: "Revoke privilege",
          }),
        },
      ],
    }),
  ],
});
