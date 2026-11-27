import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import type { DexConfig, DexProject } from "./config.js";
import { DexOutputError } from "./envelope.js";
import { publicMessage } from "./messages.js";
import { readResult, saveResult, type ViewResult } from "./results.js";
import type { DexRun, DexRunner } from "./runner.js";
import { parseView, VIEW_COMMANDS, type ViewKind } from "./views.js";

function outcome(
  kind: ViewKind,
  project: DexProject,
  { root, envelope }: DexRun,
): Parameters<typeof saveResult>[3] {
  const paths = [root, project.path];
  if (envelope.status === "ok") {
    const content = parseView(kind, envelope.data);
    return content.format === "unrecognized"
      ? {
          state: "unrecognized",
          message:
            "Dex succeeded, but DSUI does not recognize this result. Check the Dex version.",
        }
      : {
          state: "ok",
          message: publicMessage(envelope.warnings.join(" "), paths),
          content,
        };
  }
  if (envelope.status === "needs_confirmation")
    return {
      state: "needs-confirmation",
      message:
        "Dex asks a person to confirm this command. Run it in a terminal; DSUI does not confirm for you.",
    };
  return {
    state: "error",
    message: publicMessage(
      envelope.errors.join(" ") || `Dex returned ${envelope.status}`,
      paths,
    ),
  };
}

/** Runs one read-only command and records what happened. */
export async function refreshView({
  run,
  config,
  storage,
  project,
  view,
}: {
  run: DexRunner;
  config: DexConfig;
  storage: PluginStorage;
  project: DexProject;
  view: ViewKind;
}): Promise<ViewResult> {
  let result: Parameters<typeof saveResult>[3];
  try {
    result = outcome(
      view,
      project,
      await run(config, project, VIEW_COMMANDS[view]),
    );
  } catch (error) {
    if (!(error instanceof DexOutputError)) throw error;
    result = { state: "error", message: error.message };
  }
  saveResult(storage, project.id, view, result);
  return readResult(storage, project.id, view);
}
