import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const queryEditorStore = defineStore({
  id: "query-editor",
  scope: "page",
  state: {
    sql: "",
    currentQueryId: null as string | null,
    activeTab: "results",
  },
  actions: ({ set }) => ({
    setSql: (sql: string) => set({ sql }),
    setCurrentQueryId: (currentQueryId: string | null) =>
      set({ currentQueryId }),
    setActiveTab: (activeTab: string) => set({ activeTab }),
  }),
});
