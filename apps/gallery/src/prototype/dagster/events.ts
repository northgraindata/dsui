/* The structured event log of a run, built from its steps. */
import { assetByKey } from "./graph";
import { type Run, stepsOf } from "./runs";
import { hash } from "./scenario";

export interface RunEvent {
  at: Date;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  type: string;
  step?: string;
  message: string;
  detail?: string;
}

export function eventsOf(run: Run): RunEvent[] {
  const made: RunEvent[] = [];
  const at = (seconds: number) =>
    new Date((run.start ?? run.created).getTime() + seconds * 1000);
  const push = (
    seconds: number,
    type: string,
    message: string,
    extra: Partial<RunEvent> = {},
  ) => made.push({ at: at(seconds), level: "INFO", type, message, ...extra });
  push(0, "RUN_ENQUEUED", `Run ${run.id} was queued.`);
  if (!run.start) return made;
  push(1, "RUN_START", `Started execution of run for "${run.job}".`);
  for (const step of stepsOf(run)) {
    if (!step.status) continue;
    const on = { step: step.name };
    if (step.status === "SKIPPED") {
      push(
        step.from,
        "STEP_SKIPPED",
        "Skipped because an upstream step did not succeed.",
        { ...on, level: "WARNING" },
      );
      continue;
    }
    push(
      step.from,
      "STEP_START",
      `Started execution of step "${step.name}".`,
      on,
    );
    const rows = 1000 + (hash(run.id + step.key) % 900_000);
    if (step.asset && assetByKey.get(step.asset)?.kinds.includes("dbt"))
      push(
        step.from + 1,
        "LOG_MESSAGE",
        `Running with dbt=1.9.1: 1 of 1 START sql table model ${step.name}`,
        { ...on, level: "DEBUG" },
      );
    else
      push(step.from + 1, "LOG_MESSAGE", `Reading input for ${step.name}`, on);
    if (step.status === "FAILURE") {
      step.attempts.forEach((attempt, index) => {
        const last = index === step.attempts.length - 1;
        if (index)
          push(
            attempt.from,
            "STEP_RESTARTED",
            `Started attempt ${index + 1} of step "${step.name}".`,
            on,
          );
        push(
          attempt.from + attempt.seconds,
          last ? "STEP_FAILURE" : "STEP_UP_FOR_RETRY",
          last
            ? `Execution of step "${step.name}" failed. ${run.failure?.line}`
            : `Step "${step.name}" will be retried in 30 seconds. ${run.failure?.line}`,
          {
            ...on,
            level: last ? "ERROR" : "WARNING",
            detail: run.failure?.error,
          },
        );
      });
    } else if (step.status === "SUCCESS") {
      const end = step.from + step.seconds;
      push(
        end - 1,
        "LOG_MESSAGE",
        `${rows.toLocaleString("en")} rows written`,
        on,
      );
      if (step.asset)
        push(
          end,
          "ASSET_MATERIALIZATION",
          `Materialized value ${step.asset}${run.partition ? ` (partition ${run.partition})` : ""}.`,
          on,
        );
      push(
        end,
        "STEP_SUCCESS",
        `Finished execution of step "${step.name}" in ${Math.round(step.seconds)}s.`,
        on,
      );
    }
  }
  const seconds = run.end
    ? (run.end.getTime() - run.start.getTime()) / 1000
    : 0;
  if (run.status === "SUCCESS")
    push(seconds, "RUN_SUCCESS", `Finished execution of run for "${run.job}".`);
  if (run.status === "FAILURE")
    push(
      seconds,
      "RUN_FAILURE",
      `Execution of run for "${run.job}" failed. Steps failed: ["${run.failure?.step.split("/").at(-1)}"].`,
      { level: "ERROR" },
    );
  if (run.status === "CANCELED")
    push(seconds, "RUN_CANCELED", "The run was terminated.", {
      level: "WARNING",
    });
  return made.sort((a, b) => a.at.getTime() - b.at.getTime());
}
