import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const queryFiltersStore = defineStore({
  id: "query-filters",
  scope: "page",
  state: {
    warehouse: null as string | null,
    status: null as string | null,
    search: "",
  },
  actions: ({ set }) => ({
    setWarehouse: (warehouse: string | null) => set({ warehouse }),
    setStatus: (status: string | null) => set({ status }),
    setSearch: (search: string) => set({ search }),
  }),
});
