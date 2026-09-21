import { defineStore } from "@northgraindata/dsui-adapter-sdk";
import type { QueryHistoryEntry } from "../context.js";

export const queryHistoryStore = defineStore({
  id: "query-history",
  scope: "adapter",
  persistence: {
    type: "persistent",
    key: "duckdb-query-history",
    version: 1,
  },
  state: {
    entries: [] as QueryHistoryEntry[],
  },
  actions: () => ({}),
});
