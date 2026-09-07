import {
  Button,
  CodeEditor,
  definePage,
  PageHeader,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import { cancelQuery, runQuery } from "../actions/run-query.js";
import { QueryContextBar } from "../components/query-context-bar.js";
import { queryEditorStore } from "../stores/query-editor.js";
import { sessionStore } from "../stores/session.js";

export const queryEditorPage = definePage({
  path: "/query",
  stores: [sessionStore, queryEditorStore],
  render: ({ stores }) => {
    const session = stores.use(sessionStore);
    const editor = stores.use(queryEditorStore);
    return [
      PageHeader({ title: "Query editor" }),
      QueryContextBar({
        role: session.role,
        warehouse: session.warehouse,
        database: session.database,
        schema: session.schema,
      }),
      // Session editing works today: TextInputs bind store state and
      // actions directly. Option-list Selects (SessionBar) need renderer
      // support to populate options from listRoles/listWarehouses.
      TextInput({
        name: "role",
        label: "Role",
        value: session.role ?? "",
        onChange: (value) => session.setRole(value || null),
      }),
      TextInput({
        name: "warehouse",
        label: "Warehouse",
        value: session.warehouse ?? "",
        onChange: (value) => session.setWarehouse(value || null),
      }),
      TextInput({
        name: "database",
        label: "Database",
        value: session.database ?? "",
        onChange: (value) => session.setDatabase(value || null),
      }),
      TextInput({
        name: "schema",
        label: "Schema",
        value: session.schema ?? "",
        onChange: (value) => session.setSchema(value || null),
      }),
      CodeEditor({
        language: "sql",
        value: editor.sql,
        onChange: editor.setSql,
      }),
      // Bindings validate on creation, so both buttons are guarded:
      // Run needs non-empty SQL, Cancel needs a tracked query id.
      ...(editor.sql
        ? [
            Button({
              label: "Run",
              variant: "primary",
              action: runQuery({
                sql: editor.sql,
                warehouse: session.warehouse,
                database: session.database,
                schema: session.schema,
              }),
            }),
          ]
        : []),
      // Conditional UI from store state: Cancel only exists while a query
      // is tracked. (Binding creation validates, so the guard matters.)
      ...(editor.currentQueryId
        ? [
            Button({
              label: "Cancel",
              variant: "danger",
              action: cancelQuery({ queryId: editor.currentQueryId }),
            }),
          ]
        : []),
    ];
  },
});
