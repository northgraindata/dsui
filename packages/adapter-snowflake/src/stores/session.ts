import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const sessionStore = defineStore({
  id: "session",
  scope: "adapter",
  state: {
    role: null as string | null,
    secondaryRoles: [] as string[],
    warehouse: null as string | null,
    database: null as string | null,
    schema: null as string | null,
  },
  actions: ({ set }) => ({
    setRole: (role: string | null) => set({ role }),
    setSecondaryRoles: (secondaryRoles: string[]) => set({ secondaryRoles }),
    setWarehouse: (warehouse: string | null) => set({ warehouse }),
    setDatabase: (database: string | null) => set({ database }),
    setSchema: (schema: string | null) => set({ schema }),
  }),
});
