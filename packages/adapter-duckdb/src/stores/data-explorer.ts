import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const dataExplorerStore = defineStore({
  id: "data-explorer",
  scope: "page",
  state: {
    search: "",
    objectType: "all" as "all" | "table" | "view",
  },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
    setObjectType: (objectType: "all" | "table" | "view") =>
      set({ objectType }),
  }),
});
