import {
  type OutputCommand,
  outputCommandSchema,
  outputCommands,
  type RunDetail,
  runOutputSchema,
} from "../contract";
import type { Client } from "./client";
import { isActive } from "./format";
import { OptionSelect } from "./option-select";
import { React } from "./react";

function Payload({
  client,
  run,
  command,
}: {
  client: Client;
  run: RunDetail;
  command: OutputCommand;
}) {
  const [json, setJson] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [feedback, setFeedback] = React.useState<string>();
  const { id: runId, projectId } = run;

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await client.executeAction({
          actionId: "run-output",
          input: { projectId, runId, command },
        });
        if (result.status !== "success")
          throw new Error(result.message ?? "Could not load JSON");
        const output = runOutputSchema.nullable().parse(result.data);
        if (output?.json == null)
          throw new Error("This response is no longer available.");
        if (active) setJson(JSON.stringify(JSON.parse(output.json), null, 2));
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load JSON",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [client, projectId, runId, command]);

  if (error)
    return (
      <p role="alert" className="dx-error">
        {error}
      </p>
    );
  if (json === undefined) return <p role="status">Loading JSON…</p>;

  return (
    <>
      <div className="dx-actions dx-json-actions">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(json);
              setFeedback("Copied");
            } catch {
              setFeedback("Could not copy JSON");
            }
          }}
        >
          Copy JSON
        </button>
        <button
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([json], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `dex-${command}-${runId}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          }}
        >
          Download JSON
        </button>
        {feedback && <small role="status">{feedback}</small>}
      </div>
      <pre className="dx-code">{json}</pre>
    </>
  );
}

export function JsonOutput({
  client,
  run,
}: {
  client: Client;
  run: RunDetail;
}) {
  const commandId = React.useId();
  const [selected, setSelected] = React.useState<OutputCommand>();
  const outputs = run.outputs ?? [];
  if (!run.capturesOutput)
    return <p className="dx-empty">JSON was not recorded for this run.</p>;
  if (outputs.length === 0)
    return (
      <p className="dx-empty">
        {isActive(run)
          ? "Waiting for the first Dex response…"
          : "No Dex response was recorded."}
      </p>
    );

  const commands = outputCommandSchema.options.filter(
    (command) => !run.commands || run.commands.includes(command),
  );
  const current =
    selected ??
    commands.find((command) =>
      outputs.some(
        (item) => item.command === command && item.state === "available",
      ),
    ) ??
    outputs[0]?.command;
  if (!current) return null;
  const output = outputs.find((item) => item.command === current);

  return (
    <div className="dx-json">
      <div className="dx-field">
        <label htmlFor={commandId}>Command</label>
        <OptionSelect
          id={commandId}
          value={current}
          onValueChange={(value) => {
            const command = outputCommandSchema.safeParse(value);
            if (command.success) setSelected(command.data);
          }}
          options={commands.map((command) => ({
            value: command,
            label: outputCommands[command],
            description:
              outputs.find((item) => item.command === command)?.status ??
              (isActive(run) ? "Pending" : "No response"),
          }))}
        />
      </div>
      {output?.state === "available" ? (
        <Payload key={current} client={client} run={run} command={current} />
      ) : (
        <p className="dx-empty">
          {output?.message ??
            (isActive(run)
              ? "Waiting for a response…"
              : "No response was recorded for this command.")}
        </p>
      )}
    </div>
  );
}
