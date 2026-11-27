import {
  defineResource,
  type PluginContext,
  PluginRequestError,
  poll,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import type { DexConfig, DexProject } from "./config.js";
import type { ProjectOverview } from "./contract.js";
import { readResult } from "./results.js";
import { listRuns, readRun, recentRuns } from "./runs.js";
import {
  listSchedules,
  nextScheduledRun,
  readSchedule,
  scheduleTimeZone,
} from "./schedules.js";
import { viewKindSchema } from "./views.js";

export type DexContext = PluginContext<DexConfig>;

export const projectIdSchema = z
  .string()
  .describe("A project id returned by the dex `projects` resource");

export function findProject(config: DexConfig, projectId: string): DexProject {
  const project = config.projects.find((item) => item.id === projectId);
  if (!project)
    throw new PluginRequestError(`Unknown Dex project "${projectId}"`, 404);
  return project;
}

/** Host paths stay out: callers only need ids to name a project. */
export const projectsResource = defineResource({
  id: "projects",
  query: (_input, context: DexContext) =>
    context.config.projects.map(({ id, name }) => ({ id, name })),
});

const viewInput = z.object({
  projectId: projectIdSchema,
  view: viewKindSchema.describe(
    "inventory: warehouse tables; diagram: Mermaid ER diagram; semantic: metrics; plans: proposed dbt changes",
  ),
});

/** One cached view, paged so a large warehouse fits an agent's context. */
export const viewResource = defineResource({
  id: "view",
  input: viewInput.extend({
    offset: z.number().int().min(0).default(0).describe("First row to return"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50)
      .describe("Most rows to return"),
  }),
  query: ({ projectId, view, offset, limit }, context: DexContext) => {
    findProject(context.config, projectId);
    const result = readResult(context.storage, projectId, view);
    if (result.content?.format !== "rows") return result;
    const { rows } = result.content;
    return {
      ...result,
      content: { format: "rows", rows: rows.slice(offset, offset + limit) },
      totalRows: rows.length,
    };
  },
});

const REFRESH = poll("5s");

/** Every cached row of one view. Pages use it: tables only accept arrays. */
export const rowsResource = defineResource({
  id: "view-rows",
  input: viewInput,
  refresh: REFRESH,
  query: ({ projectId, view }, context: DexContext) => {
    findProject(context.config, projectId);
    const { content } = readResult(context.storage, projectId, view);
    return content?.format === "rows" ? content.rows : [];
  },
});

export const statusResource = defineResource({
  id: "view-status",
  input: viewInput,
  refresh: REFRESH,
  query: ({ projectId, view }, context: DexContext) => {
    findProject(context.config, projectId);
    const result = readResult(context.storage, projectId, view);
    return [
      {
        status: result.state,
        message: result.message,
        checked: result.checkedAt ?? "",
        dataFrom: result.contentAt ?? "",
      },
    ];
  },
});

export const diagramResource = defineResource({
  id: "diagram",
  input: z.object({ projectId: projectIdSchema }),
  refresh: REFRESH,
  query: ({ projectId }, context: DexContext) => {
    findProject(context.config, projectId);
    const { content } = readResult(context.storage, projectId, "diagram");
    return {
      mermaid:
        content?.format === "mermaid"
          ? content.mermaid
          : "No diagram yet. Run `dex explore map` in the project, then refresh.",
    };
  },
});

const CHECK_REFRESH = poll("3s");

export const overviewResource = defineResource({
  id: "overview",
  refresh: CHECK_REFRESH,
  query: (_input, context: DexContext): ProjectOverview[] =>
    context.config.projects.map(({ id, name }) => ({
      id,
      name,
      ...recentRuns(context.storage, id),
      schedule: readSchedule(context.storage, id),
      nextRunAt: nextScheduledRun(context.storage, id),
    })),
});

/** One check run with its findings, paged so it fits an agent's context. */
export const runResource = defineResource({
  id: "run",
  input: z.object({
    projectId: projectIdSchema,
    runId: z
      .string()
      .optional()
      .describe("A run id from `runs`; omit for the latest run"),
    offset: z.number().int().min(0).default(0).describe("First finding"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(30)
      .describe("Most findings to return, worst first"),
  }),
  refresh: CHECK_REFRESH,
  query: ({ projectId, runId, offset, limit }, context: DexContext) => {
    findProject(context.config, projectId);
    const run = readRun(context.storage, projectId, runId);
    return {
      run: run && {
        ...run,
        findings: run.findings.slice(offset, offset + limit),
      },
      storedFindings: run?.findings.length ?? 0,
    };
  },
});

export const runsResource = defineResource({
  id: "runs",
  input: z.object({
    projectId: projectIdSchema,
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Most runs to return, newest first"),
  }),
  refresh: CHECK_REFRESH,
  query: ({ projectId, limit }, context: DexContext) => {
    findProject(context.config, projectId);
    return listRuns(context.storage, projectId, limit);
  },
});

export const schedulesResource = defineResource({
  id: "schedules",
  input: z.object({ projectId: projectIdSchema }),
  refresh: CHECK_REFRESH,
  query: ({ projectId }, context: DexContext) => {
    findProject(context.config, projectId);
    return {
      timeZone: scheduleTimeZone(context),
      rules: listSchedules(context.storage, projectId),
    };
  },
});
