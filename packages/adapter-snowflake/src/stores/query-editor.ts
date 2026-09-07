import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const queryEditorStore = defineStore({
  id: "query-editor",
  scope: "page",
  state: {
    sql: "",
    selectedTab: "results",
    currentQueryId: null as string | null,
  },
  actions: ({ set }) => ({
    setSql: (sql: string) => set({ sql }),
    setSelectedTab: (selectedTab: string) => set({ selectedTab }),
    setCurrentQueryId: (currentQueryId: string | null) =>
      set({ currentQueryId }),
  }),
});
