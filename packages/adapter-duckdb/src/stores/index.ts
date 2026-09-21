import { defineStore } from "@northgraindata/dsui-adapter-sdk";
import type { QueryHistoryEntry } from "../context.js";

export { activityFiltersStore } from "./activity-filters.js";
export { dataExplorerStore } from "./data-explorer.js";
export { fileBrowserStore } from "./file-browser.js";
export { notebookStore } from "./notebook.js";
export { queryEditorStore } from "./query-editor.js";
export { sessionStore } from "./session.js";

export const queryHistoryStore = defineStore({
  id: "query-history",
  scope: "adapter",
  persistence: { type: "persistent", version: 1 },
  state: { entries: [] as QueryHistoryEntry[] },
  actions: ({ get, set }) => ({
    append: (entry: QueryHistoryEntry) =>
      set({ entries: [entry, ...get().entries].slice(0, 100) }),
  }),
});

export const settingsFilterStore = defineStore({
  id: "settings-filter",
  scope: "page",
  state: { search: "" },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
  }),
});
