import { z } from "zod";
import {
  type OutputCommand,
  outputCommandSchema,
  type RunSummary,
} from "../contract";
import type { Client } from "./client";
import { CommandPicker } from "./command-picker";
import { isActive } from "./format";
import { React } from "./react";

const queuedSchema = z.object({ runId: z.string() });

export function RunButton({
  client,
  projectId,
  latest,
  started,
}: {
  client: Client;
  projectId: string;
  latest: RunSummary | null;
  started: (runId: string) => void;
}) {
  const [choosing, setChoosing] = React.useState(false);
  const [commands, setCommands] = React.useState<OutputCommand[]>([
    ...outputCommandSchema.options,
  ]);
  const [starting, setStarting] = React.useState(false);
  const [waitingFor, setWaitingFor] = React.useState<{
    previousId: string | undefined;
  }>();
  const [error, setError] = React.useState<string>();
  const waiting =
    waitingFor !== undefined && waitingFor.previousId === latest?.id;
  const running = isActive(latest);

  React.useEffect(() => {
    if (!waiting && waitingFor) setWaitingFor(undefined);
  }, [waiting, waitingFor]);

  let label = "Run now";
  if (starting) label = "Starting…";
  else if (waiting || latest?.status === "queued") label = "Queued…";
  else if (running) label = "Running…";

  const busy = starting || waiting || running;
  const start = async (selected?: OutputCommand[]) => {
    setStarting(true);
    setError(undefined);
    try {
      const result = await client.executeAction({
        actionId: "run-check",
        input: { projectId, ...(selected && { commands: selected }) },
      });
      if (result.status !== "success")
        throw new Error(result.message ?? "Could not start the check");
      const { runId } = queuedSchema.parse(result.data);
      setWaitingFor({ previousId: latest?.id });
      setChoosing(false);
      started(runId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start the check",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="dx-run-control">
      <div className="dx-actions">
        <button
          type="button"
          className="dx-primary"
          disabled={busy || choosing}
          onClick={() => void start()}
        >
          {label}
        </button>
        <button
          type="button"
          aria-expanded={choosing}
          disabled={busy}
          onClick={() => {
            setError(undefined);
            setChoosing(!choosing);
          }}
        >
          Choose commands
        </button>
      </div>
      {choosing && (
        <form
          className="dx-schedule-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && commands.length > 0) void start(commands);
          }}
        >
          <CommandPicker
            commands={commands}
            disabled={busy}
            change={setCommands}
          />
          <div className="dx-actions">
            <button
              type="submit"
              className="dx-primary"
              disabled={busy || commands.length === 0}
            >
              {starting ? "Starting…" : "Run selected"}
            </button>
            <button
              type="button"
              disabled={starting}
              onClick={() => setChoosing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="dx-error">
          {error}
        </p>
      )}
    </div>
  );
}
