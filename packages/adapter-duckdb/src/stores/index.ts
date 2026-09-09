import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export { activityFiltersStore } from "./activity-filters.js";
export { dataExplorerStore } from "./data-explorer.js";
export { fileBrowserStore } from "./file-browser.js";
export { queryEditorStore } from "./query-editor.js";
export { sessionStore } from "./session.js";

export const settingsFilterStore = defineStore({
  id: "settings-filter",
  scope: "page",
  state: { search: "" },
  actions: ({ set }) => ({
    setSearch: (search: string) => set({ search }),
  }),
});
