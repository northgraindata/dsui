import { z } from "zod";
import { defineAction } from "./action/index";
import { definePage } from "./page/index";
import { defineResource } from "./resource/index";
import { defineStore } from "./store/index";

// Resource input inference: valid calls compile, invalid ones fail.
const schemas = defineResource({
  id: "schemas",
  input: z.object({ database: z.string() }),
  query: ({ database }) => [database],
});

schemas({ database: "ANALYTICS" });
// @ts-expect-error - database must be a string
schemas({ database: 123 });
// @ts-expect-error - unknown fields are rejected
schemas({ database: "A", extra: true });

// Action input inference.
const resizeWarehouse = defineAction({
  id: "resize-warehouse",
  input: z.object({
    warehouse: z.string(),
    size: z.enum(["XSMALL", "SMALL", "MEDIUM", "LARGE"]),
  }),
  run: ({ size }) => size,
});

resizeWarehouse({ warehouse: "W", size: "SMALL" });
// @ts-expect-error - size must be a known enum value
resizeWarehouse({ warehouse: "W", size: "HUGE" });
// @ts-expect-error - warehouse is required
resizeWarehouse({ size: "SMALL" });

// Store state and actions are inferred.
const sessionStore = defineStore({
  id: "session",
  scope: "adapter",
  state: { role: null as string | null },
  actions: ({ set }) => ({
    setRole: (role: string) => set({ role }),
  }),
});

declare const bound: Readonly<{ role: string | null }> & {
  setRole: (role: string) => void;
};
const _role: string | null = bound.role;
bound.setRole("ADMIN");
// @ts-expect-error - setRole takes a string
bound.setRole(42);

// Route params are inferred from the path.
definePage({
  path: "/databases/:database/schemas/:schema",
  render: ({ params }) => {
    const db: string = params.database;
    const schema: string = params.schema;
    void db;
    void schema;
    // @ts-expect-error - unknown params do not exist
    params.table;
    return [];
  },
});

export { resizeWarehouse, schemas, sessionStore };
