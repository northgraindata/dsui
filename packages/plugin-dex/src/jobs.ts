import {
  type PluginContext,
  PluginRequestError,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { stepsForCommands } from "./check.js";
import type { DexConfig } from "./config.js";
import type { OutputCommand, RunSummary } from "./contract.js";
import { findProject } from "./resources.js";
import { createRun, interruptRuns } from "./runs.js";
import { claimSchedules, scheduleTimeZone } from "./schedules.js";

export const CHECK_JOB = "check";

export const checkInputSchema = z.object({
  runId: z.string(),
  projectId: z.string(),
});

type StartContext = Pick<
  PluginContext<DexConfig>,
  "storage" | "jobs" | "installationTimeZone"
>;

/** Records the run first, so it shows as queued as soon as this returns. */
export async function startCheck(
  context: StartContext,
  config: DexConfig,
  projectId: string,
  options: {
    trigger: RunSummary["trigger"];
    scheduled?: { scheduleId: string; scheduledFor: string };
    commands?: readonly OutputCommand[];
  },
): Promise<string> {
  const project = findProject(config, projectId);
  const runId = createRun(
    context.storage,
    project.id,
    options.trigger,
    stepsForCommands(options.commands),
    options,
  );
  try {
    await context.jobs.enqueue(CHECK_JOB, { runId, projectId: project.id });
  } catch (error) {
    interruptRuns(context.storage, "DSUI could not queue this check", runId);
    throw error;
  }
  return runId;
}

/** Starts every due scheduled check. */
export async function runSchedules(
  context: StartContext,
  config: DexConfig,
  warn: (message: string) => void,
): Promise<void> {
  const due = claimSchedules(
    context.storage,
    new Set(config.projects.map((project) => project.id)),
    scheduleTimeZone(context),
  );
  for (const [projectId, scheduled] of due) {
    try {
      await startCheck(context, config, projectId, {
        trigger: "scheduled",
        scheduled,
        commands: [...scheduled.commands],
      });
    } catch (error) {
      if (!(error instanceof PluginRequestError) || error.status !== 409)
        warn(`Could not queue scheduled Dex check for "${projectId}"`);
    }
  }
}
