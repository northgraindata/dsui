import {
  Button,
  CodeEditor,
  definePage,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "../actions/run-query.js";
import { queryEditorStore } from "../stores/query-editor.js";

export const queryPage = definePage({
  path: "/query",
  stores: [queryEditorStore],
  render: ({ stores }) => {
    const editor = stores.use(queryEditorStore);
    return [
      PageHeader({
        title: "Query editor",
        description:
          "Run bounded SQL statements against the configured database.",
      }),
      CodeEditor({
        language: "sql",
        value: editor.sql,
        onChange: editor.setSql,
      }),
      ...(editor.sql
        ? [
            Button({
              label: "Run query",
              variant: "primary",
              action: runQuery({ sql: editor.sql }),
            }),
          ]
        : []),
    ];
  },
});
