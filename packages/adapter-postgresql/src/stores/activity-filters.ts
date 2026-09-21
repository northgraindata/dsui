import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const activityFiltersStore = defineStore({
  id: "activity-filters",
  scope: "page",
  state: {
    state: "",
  },
  actions: ({ set }) => ({
    setState: (state: string | null) => set({ state: state ?? "" }),
  }),
});
