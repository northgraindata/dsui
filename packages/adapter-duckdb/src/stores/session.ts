import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const sessionStore = defineStore({
  id: "session",
  scope: "adapter",
  state: {
    database: null as string | null,
    schema: null as string | null,
    openNotebookIds: [] as string[],
  },
  actions: ({ get, set, reset }) => ({
    setDatabase: (database: string | null) => set({ database }),
    setSchema: (schema: string | null) => set({ schema }),
    resetContext: () => reset(),
    openNotebook: (id: string) => {
      const openNotebookIds = get().openNotebookIds;
      if (!openNotebookIds.includes(id))
        set({ openNotebookIds: [...openNotebookIds, id] });
    },
    closeNotebook: (id: string) =>
      set({
        openNotebookIds: get().openNotebookIds.filter((item) => item !== id),
      }),
  }),
});
