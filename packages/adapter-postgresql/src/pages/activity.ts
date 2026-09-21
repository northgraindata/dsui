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
        description: "Active PostgreSQL sessions refreshed every second.",
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
        columns: [
          { id: "database", label: "Database" },
          { id: "state", label: "State" },
          { id: "queryStart", label: "Started" },
          { id: "runningFor", label: "Running for", format: "duration" },
          { id: "progressPercent", label: "Progress", format: "progress" },
          { id: "etaSeconds", label: "ETA", format: "eta" },
          { id: "query", label: "Query" },
          { id: "waitEvent", label: "Wait event" },
        ],
        rowActions: [
          {
            label: "Cancel",
            variant: "danger",
            action: "cancel-query",
            input: { pid: "pid" },
            confirmation: {
              title: "Cancel query?",
              description: "Ask PostgreSQL to cancel this backend query.",
              confirmLabel: "Cancel query",
            },
          },
        ],
        searchable: true,
        pageSize: 100,
      }),
    ];
  },
});
