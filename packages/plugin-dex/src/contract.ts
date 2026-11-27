/** Shapes shared by the server and the browser component. */
import { z } from "zod";

export const SCHEDULE_MINUTES = [0, 15, 60, 360, 1440] as const;

export const outputCommands = {
  map: "dex explore map",
  verify: "dex maintain verify",
  drift: "dex maintain check",
  inventory: "dex explore inventory",
  diagram: "dex explore diagram",
  semantic: "dex explore semantic list",
  plans: "dex transform plans",
} as const;

export const outputCommandSchema = z.enum([
  "map",
  "verify",
  "drift",
  "inventory",
  "diagram",
  "semantic",
  "plans",
]);
export const runCommandsSchema = z
  .array(outputCommandSchema)
  .min(1)
  .max(outputCommandSchema.options.length)
  .refine(
    (commands) => new Set(commands).size === commands.length,
    "Commands must be unique",
  );

export const runStatusSchema = z.enum([
  "queued",
  "running",
  /** Every required check ran and found nothing above low severity. */
  "valid",
  "partial",
  "issues",
  /** A required check did not finish, so the project cannot be called valid. */
  "incomplete",
]);

export const stepSchema = z.object({
  id: z.enum(["map", "verify", "drift", "data"]),
  label: z.string(),
  state: z.enum([
    "pending",
    "running",
    "ok",
    "skipped",
    "needs-confirmation",
    "failed",
  ]),
  message: z.string(),
});

export const findingSchema = z.object({
  source: z.enum(["verify", "drift"]),
  axis: z.string(),
  code: z.string(),
  identifier: z.string().nullable(),
  column: z.string().nullable(),
  severity: z.string(),
  detail: z.string(),
});

export const runSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  trigger: z.enum(["manual", "scheduled"]),
  status: runStatusSchema,
  message: z.string(),
  createdAt: z.string(),
  scheduleId: z.string().nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  /** All findings, including low severity. */
  findingCount: z.number(),
  /** Findings above low severity. */
  problemCount: z.number(),
  driftChecked: z.boolean(),
});

export const outputSummarySchema = z.object({
  command: outputCommandSchema,
  status: z.string(),
  state: z.enum(["available", "too-large", "unavailable"]),
  message: z.string(),
});
export const runOutputSchema = outputSummarySchema.extend({
  json: z.string().nullable(),
});
export type OutputCommand = z.infer<typeof outputCommandSchema>;
export type ScheduleRule = z.infer<typeof scheduleRuleSchema>;
export type ScheduleRuleInput = z.infer<typeof scheduleRuleInputSchema>;

export const runDetailSchema = runSummarySchema.extend({
  steps: z.array(stepSchema),
  findings: z.array(findingSchema),
  /** What Dex said it could not check. */
  notChecked: z.array(z.string()),
  capturesOutput: z.boolean().optional(),
  outputs: z.array(outputSummarySchema).optional(),
  commands: runCommandsSchema.optional(),
});

export const scheduleSchema = z.object({
  intervalMinutes: z.number(),
  nextRunAt: z.string().nullable(),
});

export const scheduleRuleInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("interval"),
    intervalMinutes: z.number().int().min(1).max(1440),
  }),
  z.object({
    kind: z.literal("daily"),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  }),
]);

export const scheduleRuleSchema = z.object({
  id: z.string(),
  rule: scheduleRuleInputSchema,
  commands: runCommandsSchema.optional(),
  enabled: z.boolean(),
  nextRunAt: z.string().nullable(),
});

export const schedulesSchema = z.object({
  timeZone: z.string(),
  rules: z.array(scheduleRuleSchema),
});

export const projectOverviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastRun: runSummarySchema.nullable(),
  lastResult: z
    .object({
      run: runSummarySchema,
      problem: findingSchema.nullable(),
      failedStep: stepSchema.nullable(),
    })
    .nullable()
    .optional(),
  schedule: scheduleSchema,
  nextRunAt: z.string().nullable().optional(),
});

export type RunStatus = z.output<typeof runStatusSchema>;
export type RunStep = z.output<typeof stepSchema>;
export type Finding = z.output<typeof findingSchema>;
export type RunSummary = z.output<typeof runSummarySchema>;
export type RunDetail = z.output<typeof runDetailSchema>;
export type Schedule = z.output<typeof scheduleSchema>;
export type ProjectOverview = z.output<typeof projectOverviewSchema>;
