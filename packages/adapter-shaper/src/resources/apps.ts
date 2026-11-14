import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { ShaperApp, ShaperContext } from "../context.js";
import { appLocation, formatDuration, formatTimestamp } from "./format.js";

const VISIBILITY_LABEL = {
  private: "Private",
  public: "Public",
  "password-protected": "Password",
} as const;

function dashboardRow(app: ShaperApp) {
  return {
    id: app.id,
    type: "dashboard",
    name: app.name,
    path: app.path,
    location: appLocation(app),
    updatedAt: formatTimestamp(app.updatedAt),
    updatedBy: app.updatedBy ?? "",
    visibility: app.visibility ?? "private",
    visibilityLabel: VISIBILITY_LABEL[app.visibility ?? "private"],
  };
}

const TASK_STATUS = {
  never: { label: "Not run", tone: "muted" },
  succeeded: { label: "Succeeded", tone: "healthy" },
  failed: { label: "Failed", tone: "unavailable" },
} as const;

function taskRow(app: ShaperApp) {
  const info = app.taskInfo ?? {};
  let status: keyof typeof TASK_STATUS = "never";
  if (info.lastRunAt !== undefined)
    status = info.lastRunSuccess ? "succeeded" : "failed";
  return {
    id: app.id,
    type: "task",
    name: app.name,
    path: app.path,
    location: appLocation(app),
    status,
    statusLabel: TASK_STATUS[status].label,
    statusTone: TASK_STATUS[status].tone,
    lastRunAt: formatTimestamp(info.lastRunAt),
    lastRunDuration: formatDuration(info.lastRunDuration),
    nextRunAt: formatTimestamp(info.nextRunAt),
    nextRunLabel: info.nextRunAt
      ? `Next ${formatTimestamp(info.nextRunAt)}`
      : "",
  };
}

const appInput = z.object({ id: z.string().min(1) });

export const dashboards = defineResource({
  id: "dashboards",
  description: "List the dashboards deployed on the Shaper server.",
  query: async (_input: undefined, ctx: ShaperContext) =>
    (await ctx.client.listApps())
      .filter((app) => app.type === "dashboard")
      .map(dashboardRow),
  refresh: poll("15s"),
});

export const tasks = defineResource({
  id: "tasks",
  description: "List scheduled tasks with their last and next run.",
  query: async (_input: undefined, ctx: ShaperContext) =>
    (await ctx.client.listApps())
      .filter((app) => app.type === "task")
      .map(taskRow),
  refresh: poll("15s"),
});

/** One dashboard or task including its SQL, for the editor pages. */
export const app = defineResource({
  id: "app",
  description:
    "Read one dashboard or task by id, including its SQL source, folder and last update.",
  input: appInput,
  query: async ({ id }, ctx: ShaperContext) => {
    const found = (await ctx.client.listApps()).find(
      (candidate) => candidate.id === id && candidate.type !== "_folder",
    );
    if (!found) throw new Error(`Shaper app ${id} was not found`);
    return {
      id: found.id,
      type: found.type,
      name: found.name,
      path: found.path,
      content: found.content ?? "",
      updatedAt: formatTimestamp(found.updatedAt),
      createdAt: formatTimestamp(found.createdAt),
      updatedBy: found.updatedBy ?? "",
      visibility: found.visibility ?? "private",
      navigation: [
        {
          label: `Open ${found.name} in DSUI`,
          path:
            found.type === "dashboard"
              ? `/dashboards/${encodeURIComponent(found.id)}`
              : `/tasks/${encodeURIComponent(found.id)}/edit`,
        },
      ],
    };
  },
});

function tasksOf(apps: readonly ShaperApp[]) {
  return apps.filter((item) => item.type === "task");
}

export const overview = defineResource({
  id: "overview",
  query: async (_input: undefined, ctx: ShaperContext) => {
    const apps = await ctx.client.listApps();
    const tasks = tasksOf(apps).map(taskRow);
    return {
      dashboards: apps.filter((item) => item.type === "dashboard").length,
      tasks: tasks.length,
      failedTasks: tasks.filter((task) => task.status === "failed").length,
      neverRun: tasks.filter((task) => task.status === "never").length,
    };
  },
  refresh: poll("15s"),
});

/** Succeeded, failed and not-yet-run tasks as one proportional bar. */
export const taskHealth = defineResource({
  id: "task-health",
  query: async (_input: undefined, ctx: ShaperContext) => {
    const tasks = tasksOf(await ctx.client.listApps()).map(taskRow);
    const count = (status: string) =>
      tasks.filter((task) => task.status === status).length;
    const succeeded = count("succeeded");
    const failed = count("failed");
    const never = count("never");
    const segments = [
      { label: "Succeeded", value: succeeded, tone: "healthy" as const },
      { label: "Failed", value: failed, tone: "unavailable" as const },
      { label: "Not run", value: never, tone: "muted" as const },
    ].filter((segment) => segment.value > 0);
    return {
      segments:
        segments.length > 0
          ? segments
          : [{ label: "No tasks", value: 1, tone: "muted" as const }],
      format: "number" as const,
      footer:
        tasks.length === 0
          ? "Create a task to run SQL on a schedule"
          : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
    };
  },
  refresh: poll("15s"),
});

/** Tasks whose latest run failed, newest first. */
export const failingTasks = defineResource({
  id: "failing-tasks",
  description: "Tasks whose last run failed.",
  query: async (_input: undefined, ctx: ShaperContext) =>
    tasksOf(await ctx.client.listApps())
      .filter(
        (task) =>
          task.taskInfo?.lastRunAt !== undefined &&
          task.taskInfo.lastRunSuccess === false,
      )
      .sort((a, b) =>
        (b.taskInfo?.lastRunAt ?? "").localeCompare(
          a.taskInfo?.lastRunAt ?? "",
        ),
      )
      .map(taskRow),
  refresh: poll("15s"),
});

/** Scheduled tasks ordered by their next run. */
export const upcomingTasks = defineResource({
  id: "upcoming-tasks",
  description: "Tasks with a scheduled next run, soonest first.",
  query: async (_input: undefined, ctx: ShaperContext) =>
    tasksOf(await ctx.client.listApps())
      .filter((task) => task.taskInfo?.nextRunAt !== undefined)
      .sort((a, b) =>
        (a.taskInfo?.nextRunAt ?? "").localeCompare(
          b.taskInfo?.nextRunAt ?? "",
        ),
      )
      .slice(0, 8)
      .map(taskRow),
  refresh: poll("15s"),
});

export const recentDashboards = defineResource({
  id: "recent-dashboards",
  description: "The most recently changed dashboards.",
  query: async (_input: undefined, ctx: ShaperContext) =>
    (await ctx.client.listApps())
      .filter((app) => app.type === "dashboard")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map(dashboardRow),
  refresh: poll("15s"),
});
