import {
  definePage,
  PageHeader,
  Select,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { activity } from "../resources/activity.js";
import { activityFiltersStore } from "../stores/activity-filters.js";

export const activityPage = definePage({
  path: "/activity",
  stores: [activityFiltersStore],
  render: ({ stores }) => {
    const filters = stores.use(activityFiltersStore);
    return [
      PageHeader({
        title: "Activity",
        description: "Active PostgreSQL sessions refreshed every five seconds.",
      }),
      Select({
        name: "state",
        label: "State",
        value: filters.state,
        options: [
          { label: "All states", value: "" },
          { label: "Active", value: "active" },
          { label: "Idle", value: "idle" },
          { label: "Idle in transaction", value: "idle in transaction" },
        ],
        onChange: filters.setState,
      }),
      Table({
        source: activity({ state: filters.state || undefined }),
        searchable: true,
        pageSize: 100,
      }),
    ];
  },
});
