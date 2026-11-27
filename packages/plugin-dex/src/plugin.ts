import {
  defineAction,
  defineJob,
  definePlugin,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { COMMANDS_PER_RUN, executeCheck } from "./check.js";
import { configSchema } from "./config.js";
import {
  outputCommandSchema,
  runCommandsSchema,
  runOutputSchema,
  SCHEDULE_MINUTES,
  scheduleRuleInputSchema,
  scheduleRuleSchema,
  scheduleSchema,
} from "./contract.js";
import {
  CHECK_JOB,
  checkInputSchema,
  runSchedules,
  startCheck,
} from "./jobs.js";
import { readOutput } from "./outputs.js";
import { projectPage, projectsPage } from "./pages.js";
import { refreshView } from "./refresh.js";
import {
  type DexContext,
  diagramResource,
  findProject,
  overviewResource,
  projectIdSchema,
  projectsResource,
  rowsResource,
  runResource,
  runsResource,
  schedulesResource,
  statusResource,
  viewResource,
} from "./resources.js";
import { createRunner } from "./runner.js";
import { interruptRuns } from "./runs.js";
import {
  removeRule,
  saveRule,
  saveSchedule,
  scheduleTimeZone,
} from "./schedules.js";
import { viewKindSchema } from "./views.js";

export function createDexPlugin() {
  const run = createRunner();
  return definePlugin({
    metadata: {
      id: "dex",
      name: "Dex",
      version: "0.1.0",
      apiVersion: 1,
    },
    configSchema,
    // A run cut off by a restart would otherwise block its project forever.
    start: (context: DexContext) =>
      interruptRuns(
        context.storage,
        "DSUI restarted before this check finished",
      ),
    setup(registry, config) {
      for (const resource of [
        projectsResource,
        overviewResource,
        runResource,
        runsResource,
        schedulesResource,
        viewResource,
        rowsResource,
        statusResource,
        diagramResource,
      ])
        registry.resource(resource);

      // Actions are open to the AI agent and other plugins, so nothing here may
      // change dbt files or the warehouse, or approve spend.
      registry.action(
        defineAction({
          id: "run-check",
          input: z.object({
            projectId: projectIdSchema.describe(
              "Starts a read-only check of this project; then query the `run` resource until its status is no longer queued or running",
            ),
            commands: runCommandsSchema
              .optional()
              .describe("Dex commands to run. Omit to run the full check."),
          }),
          permission: "execute",
          run: async ({ projectId, commands }, context: DexContext) => ({
            runId: await startCheck(context, context.config, projectId, {
              trigger: "manual",
              commands,
            }),
          }),
        }),
      );
      registry.action(
        defineAction({
          id: "refresh",
          input: z.object({
            projectId: projectIdSchema,
            view: viewKindSchema.describe(
              "Which result to read again with Dex; then query the `view` resource",
            ),
          }),
          permission: "execute",
          run: async ({ projectId, view }, context: DexContext) => {
            const result = await refreshView({
              run,
              config: context.config,
              storage: context.storage,
              project: findProject(context.config, projectId),
              view,
            });
            return { state: result.state, message: result.message };
          },
        }),
      );

      // A procedure, not an action: only a person decides what runs unattended.
      registry.procedure({
        id: "set-schedule",
        permission: "manage",
        input: z.object({
          projectId: projectIdSchema,
          intervalMinutes: z
            .number()
            .refine((value) =>
              SCHEDULE_MINUTES.some((allowed) => allowed === value),
            ),
        }),
        output: scheduleSchema,
        handler: (context, { projectId, intervalMinutes }) =>
          saveSchedule(
            context.storage,
            findProject(context.config, projectId).id,
            intervalMinutes,
          ),
      });

      registry.procedure({
        id: "save-schedule",
        permission: "manage",
        input: z.object({
          projectId: projectIdSchema,
          id: z.string().optional(),
          rule: scheduleRuleInputSchema,
          commands: runCommandsSchema.optional(),
          enabled: z.boolean(),
        }),
        output: scheduleRuleSchema,
        handler: (context, input) =>
          saveRule(
            context.storage,
            findProject(context.config, input.projectId).id,
            input,
            scheduleTimeZone(context),
          ),
      });
      registry.procedure({
        id: "delete-schedule",
        permission: "manage",
        input: z.object({ projectId: projectIdSchema, id: z.string() }),
        handler: (context, { projectId, id }) => {
          removeRule(
            context.storage,
            findProject(context.config, projectId).id,
            id,
          );
          return { deleted: true };
        },
      });
      registry.procedure({
        id: "run-output",
        permission: "inspect",
        input: z.object({
          projectId: projectIdSchema,
          runId: z.string(),
          command: outputCommandSchema,
        }),
        output: runOutputSchema.nullable(),
        handler: (context, { projectId, runId, command }) =>
          readOutput(
            context.storage,
            findProject(context.config, projectId).id,
            runId,
            command,
          ),
      });

      registry.job(
        defineJob({
          id: CHECK_JOB,
          inputSchema: checkInputSchema,
          concurrency: "per-key",
          timeoutMs: COMMANDS_PER_RUN * config.commandTimeoutMs + 30_000,
          retry: { maxAttempts: 1 },
          run: async ({ input, context }) => {
            const { runId, projectId } = checkInputSchema.parse(input);
            try {
              await executeCheck({
                run,
                config,
                storage: context.storage,
                project: findProject(config, projectId),
                runId,
                signal: context.signal,
              });
            } catch (error) {
              interruptRuns(
                context.storage,
                "The check stopped before it finished",
                runId,
              );
              throw error;
            }
          },
        }),
      );
      registry.job(
        defineJob({
          id: "scheduler",
          intervalMs: 60_000,
          concurrency: "singleton",
          timeoutMs: 30_000,
          run: ({ context }) =>
            runSchedules(context, config, context.logger.warn),
        }),
      );

      registry.page(projectsPage, { id: "projects", title: "Dex" });
      registry.page(projectPage, { id: "project", title: "Dex project" });
      registry.navigation({
        id: "dex-projects",
        area: "primary",
        label: "Dex",
        pageId: "projects",
        order: 80,
      });
    },
  });
}

export default createDexPlugin();
