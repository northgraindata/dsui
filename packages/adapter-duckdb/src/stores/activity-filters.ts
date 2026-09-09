import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const activityFiltersStore = defineStore({
  id: "activity-filters",
  scope: "page",
  state: { search: "", status: null as string | null },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
    setStatus: (status: string | null) => set({ status }),
  }),
});
