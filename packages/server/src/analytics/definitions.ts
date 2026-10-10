import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens");
const subfolder = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/,
    "Use slash-separated folder names",
  )
  .optional();
const sqlFile = z
  .string()
  .regex(
    /^([a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.sql$/,
    "Use a .sql file under analytics/queries, with lowercase folder and file names",
  );

export const moduleSchema = z
  .object({
    name: slug,
    subfolder,
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500).default(""),
    source: z
      .object({
        serviceId: z.string().min(1),
        resourceId: z.string().min(1),
        input: z.record(z.unknown()).default({}),
        sqlFile: sqlFile.optional(),
        rowsPath: z
          .string()
          .regex(/^[A-Za-z0-9_.]*$/)
          .default(""),
      })
      .strict(),
    styles: z
      .object({
        accentColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#377dff"),
        height: z.enum(["compact", "regular", "tall"]).default("regular"),
        showGrid: z.boolean().default(true),
      })
      .strict()
      .default({}),
    chart: z
      .object({
        type: z.enum(["metric", "line", "bar", "table"]),
        x: z.string().default(""),
        y: z.string().default(""),
        unit: z.string().max(30).default(""),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source.sqlFile && value.source.resourceId !== "report-query")
      context.addIssue({
        code: "custom",
        path: ["source", "sqlFile"],
        message: "SQL files require the report-query resource",
      });
    if (value.source.sqlFile && value.source.input.sql !== undefined)
      context.addIssue({
        code: "custom",
        path: ["source", "input", "sql"],
        message: "Choose either inline SQL or a SQL file",
      });
    if (
      value.source.resourceId === "report-query" &&
      !value.source.sqlFile &&
      (typeof value.source.input.sql !== "string" ||
        !value.source.input.sql.trim())
    )
      context.addIssue({
        code: "custom",
        path: ["source", "input", "sql"],
        message: "Provide inline SQL or a SQL file",
      });
  });

const dashboardModuleSchema = z
  .object({
    module: slug,
    subfolder,
    width: z.enum(["half", "full"]).default("half"),
  })
  .strict();

export const dashboardSchema = z
  .object({
    name: slug,
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500).default(""),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
    ownerId: z.string().min(1).optional(),
    visibility: z.enum(["private", "shared"]).optional(),
    styles: z
      .object({
        columns: z.union([z.literal(1), z.literal(2)]).default(2),
        spacing: z.enum(["compact", "regular", "relaxed"]).default("regular"),
      })
      .strict()
      .default({}),
    modules: z.array(dashboardModuleSchema).max(40).default([]),
    views: z
      .array(
        z
          .object({
            name: slug,
            title: z.string().trim().min(1).max(80),
            modules: z.array(dashboardModuleSchema).max(40),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const tags = value.tags.map((tag) => tag.toLowerCase());
    if (new Set(tags).size !== tags.length)
      context.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Tags must be unique",
      });
    if (!value.views.length) return;
    if (value.modules.length)
      context.addIssue({
        code: "custom",
        path: ["modules"],
        message: "Use views or top-level modules, not both",
      });
    const names = value.views.map((view) => view.name);
    if (new Set(names).size !== names.length)
      context.addIssue({
        code: "custom",
        path: ["views"],
        message: "View names must be unique",
      });
  });

export type AnalyticsModule = z.infer<typeof moduleSchema>;
export type AnalyticsDashboard = z.infer<typeof dashboardSchema>;

export function dashboardModuleGroups(dashboard: AnalyticsDashboard) {
  return dashboard.views.length
    ? dashboard.views.map((view) => view.modules)
    : [dashboard.modules];
}
