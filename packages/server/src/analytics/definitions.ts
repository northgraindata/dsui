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
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
    );
  }, "Use a valid date");

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
        parameters: z
          .array(z.string().regex(/^[a-z0-9-]+(?:\.(?:start|end))?$/))
          .max(20)
          .default([]),
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
        type: z.enum([
          "metric",
          "kpi",
          "line",
          "area",
          "bar",
          "horizontal-bar",
          "table",
        ]),
        x: z.string().default(""),
        y: z.string().default(""),
        unit: z.string().max(30).default(""),
        compareTo: z.string().optional(),
        comparisonLabel: z.string().max(80).optional(),
        drilldown: z
          .object({
            module: slug,
            subfolder,
            parameter: z.string().regex(/^[a-z0-9-]+(?:\.(?:start|end))?$/),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.chart.drilldown) {
      if (!["line", "area", "bar", "horizontal-bar"].includes(value.chart.type))
        context.addIssue({
          code: "custom",
          path: ["chart", "drilldown"],
          message: "Click-through needs a line, area, or bar chart",
        });
      if (!value.chart.x.trim())
        context.addIssue({
          code: "custom",
          path: ["chart", "x"],
          message: "Click-through needs an X field",
        });
    }
    if (value.chart.type === "kpi") {
      if (!value.chart.y.trim())
        context.addIssue({
          code: "custom",
          path: ["chart", "y"],
          message: "KPI needs a current value field",
        });
      if (!value.chart.compareTo?.trim())
        context.addIssue({
          code: "custom",
          path: ["chart", "compareTo"],
          message: "KPI needs a previous period value field",
        });
    }
    if (value.source.sqlFile && value.source.resourceId !== "report-query")
      context.addIssue({
        code: "custom",
        path: ["source", "sqlFile"],
        message: "SQL files require the report-query resource",
      });
    if (
      value.source.parameters.length &&
      value.source.resourceId !== "report-query"
    )
      context.addIssue({
        code: "custom",
        path: ["source", "parameters"],
        message: "SQL parameters require the report-query resource",
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

const dashboardFilterSchema = z.discriminatedUnion("type", [
  z
    .object({
      name: slug,
      label: z.string().trim().min(1).max(80),
      type: z.literal("date-range"),
      defaultStart: isoDate.optional(),
      defaultEnd: isoDate.optional(),
    })
    .strict(),
  z
    .object({
      name: slug,
      label: z.string().trim().min(1).max(80),
      type: z.literal("select"),
      options: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
      defaultValue: z.string().optional(),
    })
    .strict(),
]);

export const dashboardSchema = z
  .object({
    name: slug,
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500).default(""),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
    filters: z.array(dashboardFilterSchema).max(8).default([]),
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
    const filterNames = value.filters.map((filter) => filter.name);
    if (new Set(filterNames).size !== filterNames.length)
      context.addIssue({
        code: "custom",
        path: ["filters"],
        message: "Filter names must be unique",
      });
    for (const [index, filter] of value.filters.entries()) {
      if (
        filter.type === "date-range" &&
        filter.defaultStart &&
        filter.defaultEnd &&
        filter.defaultStart > filter.defaultEnd
      )
        context.addIssue({
          code: "custom",
          path: ["filters", index],
          message: "Start date must be before end date",
        });
      if (
        filter.type === "select" &&
        new Set(filter.options).size !== filter.options.length
      )
        context.addIssue({
          code: "custom",
          path: ["filters", index, "options"],
          message: "Options must be unique",
        });
      if (
        filter.type === "select" &&
        filter.defaultValue &&
        !filter.options.includes(filter.defaultValue)
      )
        context.addIssue({
          code: "custom",
          path: ["filters", index, "defaultValue"],
          message: "Default must be one of the options",
        });
    }
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
