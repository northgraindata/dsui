import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const sessionStore = defineStore({
  id: "session",
  scope: "adapter",
  state: {
    database: null as string | null,
    schema: null as string | null,
  },
  actions: ({ set, reset }) => ({
    setDatabase: (database: string | null) => set({ database }),
    setSchema: (schema: string | null) => set({ schema }),
    resetContext: () => reset(),
  }),
});
