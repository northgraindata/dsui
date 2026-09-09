import {
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
import { grants, roles, userDetails, users } from "../resources/governance.js";

export const usersPage = definePage({
  path: "/users",
  render: () => [
    PageHeader({ title: "Users" }),
    Table({
      source: users(),
      rowLink: { path: "/users/:user", params: { user: "name" } },
      rowActions: [
        {
          label: "Suspend",
          action: suspendUser,
          input: { name: "name" },
          when: { field: "status", equals: "ACTIVE" },
        },
        {
          label: "Resume",
          action: resumeUser,
          input: { name: "name" },
          when: { field: "status", notEquals: "ACTIVE" },
        },
      ],
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
  render: () => [PageHeader({ title: "Roles" }), Table({ source: roles() })],
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
          content: Table({ source: grants() }),
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
