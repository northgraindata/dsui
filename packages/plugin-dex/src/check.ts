/**
 * A check run: a fixed, read-only sequence of Dex commands and one verdict.
 *
 * Dex has no single "check everything" command; this order is DSUI's.
 */
import {
  PluginRequestError,
  type PluginStorage,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import type { DexConfig, DexProject } from "./config.js";
import {
  type Finding,
  type OutputCommand,
  outputCommandSchema,
  type RunStatus,
  type RunStep,
} from "./contract.js";
import { type DexEnvelope, DexOutputError } from "./envelope.js";
import { publicMessage } from "./messages.js";
import { saveOutput } from "./outputs.js";
import { refreshView } from "./refresh.js";
import type { DexRunner } from "./runner.js";
import { finishRun, readRun, saveProgress, startRun } from "./runs.js";
import { VIEW_KINDS } from "./views.js";

const MAX_STORED_FINDINGS = 500;
const MAX_NOT_CHECKED = 50;

export const CHECK_STEPS: readonly RunStep[] = [
  { id: "map", label: "Map warehouse", state: "pending", message: "" },
  { id: "verify", label: "Verify project", state: "pending", message: "" },
  { id: "drift", label: "Check drift", state: "pending", message: "" },
  { id: "data", label: "Update data views", state: "pending", message: "" },
];

export function stepsForCommands(
  commands: readonly OutputCommand[] = outputCommandSchema.options,
): RunStep[] {
  return CHECK_STEPS.map((step) => {
    const included =
      step.id === "data"
        ? VIEW_KINDS.some((view) => commands.includes(view))
        : commands.includes(step.id);
    return included
      ? { ...step }
      : { ...step, state: "skipped", message: "Not selected" };
  });
}

/** Commands a run adds to the view commands. No confirm or spend flags. */
const CHECK_COMMANDS = {
  map: ["explore", "map"],
  verify: ["maintain", "verify"],
  drift: ["maintain", "check"],
} as const;

/** Dex runs a whole run can start, for the job timeout. */
export const COMMANDS_PER_RUN =
  Object.keys(CHECK_COMMANDS).length + VIEW_KINDS.length;

const findingsSchema = z.object({
  findings: z.array(
    z.object({
      axis: z.string(),
      code: z.string(),
      identifier: z.string().nullish(),
      column: z.string().nullish(),
      severity: z.string(),
      detail: z.string(),
    }),
  ),
});

type Outcome = {
  state: RunStep["state"];
  message: string;
  findings?: Finding[];
  notChecked?: string[];
};

/** Anything but `low` counts, so an unknown severity is never hidden. */
const isProblem = (finding: Finding) => finding.severity !== "low";

function severityRank(severity: string): number {
  const rank = ["high", "medium", "low"].indexOf(severity);
  return rank === -1 ? 1 : rank;
}

function interpret(
  id: keyof typeof CHECK_COMMANDS,
  envelope: DexEnvelope,
  paths: readonly string[],
): Outcome {
  if (envelope.status === "needs_confirmation")
    return {
      state: "needs-confirmation",
      message:
        "Dex asks a person to confirm this command. DSUI does not confirm for you.",
    };
  if (id === "drift" && envelope.reason === "prerequisite")
    return {
      state: "skipped",
      message:
        "No drift baseline. Run `dex maintain snapshot` in the project after a known-good state.",
    };
  if (envelope.status !== "ok")
    return {
      state: "failed",
      message: publicMessage(
        envelope.errors.join(" ") || `Dex returned ${envelope.status}`,
        paths,
      ),
    };
  if (id === "map") return { state: "ok", message: "" };
  const parsed = findingsSchema.safeParse(envelope.data);
  if (!parsed.success)
    return {
      state: "failed",
      message: "DSUI does not recognize this result. Check the Dex version.",
    };
  const findings = parsed.data.findings.map(
    (finding): Finding => ({
      source: id,
      axis: finding.axis,
      code: finding.code,
      identifier: finding.identifier ?? null,
      column: finding.column ?? null,
      severity: finding.severity,
      detail: publicMessage(finding.detail, paths),
    }),
  );
  return {
    state: "ok",
    message: `${findings.length} findings`,
    findings,
    notChecked: envelope.warnings.map((text) => publicMessage(text, paths)),
  };
}

export function verdict(
  steps: readonly RunStep[],
  problemCount: number,
  commands: readonly OutputCommand[] = outputCommandSchema.options,
): { status: RunStatus; message: string } {
  if (problemCount > 0)
    return {
      status: "issues",
      message: `${problemCount} problem${problemCount === 1 ? "" : "s"} found`,
    };
  if (commands.length < outputCommandSchema.options.length) {
    const selected = new Set(
      stepsForCommands(commands)
        .filter((step) => step.state === "pending")
        .map((step) => step.id),
    );
    const completed = steps.every(
      (step) => !selected.has(step.id) || step.state === "ok",
    );
    return completed
      ? { status: "partial", message: "Selected commands completed" }
      : {
          status: "incomplete",
          message: "Some selected commands did not finish",
        };
  }
  const state = (id: RunStep["id"]) =>
    steps.find((step) => step.id === id)?.state;
  const complete =
    state("map") === "ok" &&
    state("verify") === "ok" &&
    (state("drift") === "ok" || state("drift") === "skipped");
  if (!complete)
    return {
      status: "incomplete",
      message: "Some checks did not finish",
    };
  return {
    status: "valid",
    message:
      state("drift") === "skipped"
        ? "No problems found. Drift was not checked."
        : "No problems found",
  };
}

/** Executes a queued run, saving progress after every step. */
export async function executeCheck({
  run,
  config,
  storage,
  project,
  runId,
  signal,
}: {
  run: DexRunner;
  config: DexConfig;
  storage: PluginStorage;
  project: DexProject;
  runId: string;
  signal: AbortSignal;
}): Promise<void> {
  if (!startRun(storage, runId)) return;
  const commands =
    readRun(storage, project.id, runId)?.commands ??
    outputCommandSchema.options;
  const steps = stepsForCommands(commands);
  const findings: Finding[] = [];
  const notChecked = new Set<string>();

  const capture = async (id: OutputCommand, command: readonly string[]) => {
    try {
      const result = await run(config, project, command, signal);
      saveOutput(storage, runId, id, {
        envelope: result.envelope,
        paths: [result.root, project.path],
      });
      return result;
    } catch (error) {
      if (
        error instanceof PluginRequestError ||
        error instanceof DexOutputError
      )
        saveOutput(storage, runId, id, {
          message: publicMessage(error.message, [project.path]),
        });
      throw error;
    }
  };

  const attempt = async (step: RunStep): Promise<Outcome> => {
    if (step.id === "data") {
      const failed: string[] = [];
      for (const view of VIEW_KINDS.filter((view) => commands.includes(view))) {
        signal.throwIfAborted();
        try {
          const result = await refreshView({
            run: (_config, _project, command) => capture(view, command),
            config,
            storage,
            project,
            view,
          });
          if (result.state !== "ok") failed.push(view);
        } catch (error) {
          if (!(error instanceof PluginRequestError)) throw error;
          failed.push(view);
        }
      }
      return failed.length === 0
        ? { state: "ok", message: "" }
        : { state: "failed", message: `Not updated: ${failed.join(", ")}` };
    }
    const { root, envelope } = await capture(step.id, CHECK_COMMANDS[step.id]);
    return interpret(step.id, envelope, [root, project.path]);
  };

  for (const step of steps) {
    signal.throwIfAborted();
    if (step.state === "skipped") continue;
    step.state = "running";
    saveProgress(storage, runId, steps);
    let outcome: Outcome;
    try {
      outcome = await attempt(step);
    } catch (error) {
      if (
        !(error instanceof DexOutputError) &&
        !(error instanceof PluginRequestError)
      )
        throw error;
      outcome = { state: "failed", message: error.message };
    }
    step.state = outcome.state;
    step.message = outcome.message;
    findings.push(...(outcome.findings ?? []));
    for (const text of outcome.notChecked ?? []) notChecked.add(text);
    saveProgress(storage, runId, steps);
  }
  signal.throwIfAborted();

  const problemCount = findings.filter(isProblem).length;
  finishRun(storage, runId, {
    ...verdict(steps, problemCount, commands),
    steps,
    // Worst first, so the cap only ever drops the least severe.
    findings: findings
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
      .slice(0, MAX_STORED_FINDINGS),
    findingCount: findings.length,
    problemCount,
    notChecked: [...notChecked].slice(0, MAX_NOT_CHECKED),
  });
}
