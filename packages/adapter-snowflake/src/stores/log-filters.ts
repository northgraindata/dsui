import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const logFiltersStore = defineStore({
  id: "log-filters",
  scope: "page",
  state: {
    search: "",
    level: null as string | null,
  },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
    setLevel: (level: string | null) => set({ level }),
  }),
});
