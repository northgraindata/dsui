import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";

type Ctx = ShaperContext & ActionRuntimeContext;

/** Folder paths are `/`-delimited and always start and end with a slash. */
export function normalizeFolderPath(value: string): string {
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.some((part) => part === "." || part === ".."))
    throw new Error("Folder paths cannot contain . or .. segments");
  return parts.length === 0 ? "/" : `/${parts.join("/")}/`;
}

const folderPath = z
  .string()
  .default("/")
  .transform((value, context) => {
    try {
      return normalizeFolderPath(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid path",
      });
      return z.NEVER;
    }
  });

const appType = z.enum(["dashboard", "task"]);

export const createAppInput = z.object({
  type: appType,
  name: z.string().trim().min(1, "A name is required"),
  path: folderPath,
  content: z.string().min(1, "SQL is required"),
});

const SQL_GUIDE = [
  "A Shaper dashboard is DuckDB SQL: several queries separated by ';', each one becomes one element.",
  "Call validate-dashboard with the SQL first and fix any error before create-app.",
  "'Title'::SECTION starts a section; 'Card title'::LABEL as its own query titles the next element.",
  "Table: a plain SELECT. Single value: one row, one column. ::PERCENT for 0-1 values.",
  "Line chart: ts::TIMESTAMP::XAXIS, value::LINECHART, optional series::CATEGORY.",
  "Bar chart: label::XAXIS, value::BARCHART (or ::BARCHART_STACKED), optional series::CATEGORY.",
  "Pie or donut: value::PIECHART (or ::DONUTCHART), name::CATEGORY. Gauge: value::GAUGE with ::RANGE.",
  "Filters come first: col::DROPDOWN AS name, then read it with getvariable('name'). Also ::DATEPICKER and ::INPUT.",
  "Example: SELECT 'Revenue'::LABEL; SELECT sum(amount) AS Revenue FROM orders;",
  "Do not use $variable syntax. Check table and column names with the schema resources before writing SQL.",
].join(" ");

const appNavigation = (type: "dashboard" | "task", id: string) => [
  {
    label:
      type === "dashboard" ? "Open dashboard in DSUI" : "Open task in DSUI",
    path:
      type === "dashboard"
        ? `/dashboards/${encodeURIComponent(id)}`
        : `/tasks/${encodeURIComponent(id)}/edit`,
  },
];

export const createApp = defineAction({
  id: "create-app",
  description: `Create a Shaper dashboard or task from SQL. ${SQL_GUIDE} New dashboards are private; use share-dashboard to share one.`,
  input: createAppInput,
  run: async (input, ctx: Ctx) => {
    const [result] = await ctx.client.deploy(
      [
        {
          operation: "create",
          type: input.type,
          data: { name: input.name, path: input.path, content: input.content },
        },
      ],
      ctx.signal,
    );
    if (!result?.id) throw new Error("Shaper did not return the new app id");
    ctx.invalidate();
    return {
      id: result.id,
      type: input.type,
      navigation: appNavigation(input.type, result.id),
    };
  },
});

export const updateAppInput = z.object({
  id: z.string().min(1),
  type: appType,
  name: z.string().trim().min(1).optional(),
  path: folderPath.optional(),
  content: z.string().min(1).optional(),
});

export const updateApp = defineAction({
  id: "update-app",
  description: `Rename, move or change the SQL of a Shaper dashboard or task. ${SQL_GUIDE}`,
  input: updateAppInput,
  run: async ({ id, type, name, path, content }, ctx: Ctx) => {
    if (name === undefined && path === undefined && content === undefined)
      throw new Error("Nothing to update");
    await ctx.client.deploy(
      [
        {
          operation: "update",
          type,
          data: {
            id,
            ...(name !== undefined ? { name } : {}),
            ...(path !== undefined ? { path } : {}),
            ...(content !== undefined ? { content } : {}),
          },
        },
      ],
      ctx.signal,
    );
    ctx.invalidate();
    return { id, type, navigation: appNavigation(type, id) };
  },
});

export const deleteAppInput = z.object({
  id: z.string().min(1),
  type: appType,
});

export const deleteApp = defineAction({
  id: "delete-app",
  description:
    "Permanently delete a Shaper dashboard or task. Ask the user to confirm first.",
  input: deleteAppInput,
  run: async ({ id, type }, ctx: Ctx) => {
    await ctx.client.deploy(
      [{ operation: "delete", type, data: { id } }],
      ctx.signal,
    );
    ctx.invalidate();
    return { id, type };
  },
});

export const validateDashboardInput = z.object({ sql: z.string().min(1) });

/** Dry run: Shaper evaluates the dashboard queries without saving anything. */
export const validateDashboard = defineAction({
  id: "validate-dashboard",
  input: validateDashboardInput,
  run: ({ sql }, ctx: Ctx) => ctx.client.validateDashboard(sql, ctx.signal),
});
