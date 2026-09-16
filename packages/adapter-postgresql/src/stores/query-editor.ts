import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const queryEditorStore = defineStore({
  id: "query-editor",
  scope: "page",
  state: {
    sql: "select * from information_schema.tables limit 50;",
  },
  actions: ({ set }) => ({
    setSql: (sql: string) => set({ sql }),
  }),
});
