import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const fileBrowserStore = defineStore({
  id: "file-browser",
  scope: "page",
  state: { search: "", type: null as string | null },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
    setType: (type: string | null) => set({ type }),
  }),
});
