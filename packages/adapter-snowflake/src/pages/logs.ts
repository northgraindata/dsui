import {
  definePage,
  PageHeader,
  Table,
  TextInput,
} from "@northgraindata/dsui-adapter-sdk";
import { logs } from "../resources/logs.js";
import { logFiltersStore } from "../stores/log-filters.js";

export const logsPage = definePage({
  path: "/logs",
  stores: [logFiltersStore],
  render: ({ stores }) => {
    const filters = stores.use(logFiltersStore);
    return [
      PageHeader({ title: "Logs" }),
      TextInput({
        name: "search",
        label: "Search",
        value: filters.search,
        onChange: filters.setSearch,
      }),
      Table({
        source: logs({ search: filters.search, level: filters.level }),
      }),
    ];
  },
});
