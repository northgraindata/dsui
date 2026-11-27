import {
  type OutputCommand,
  outputCommandSchema,
  outputCommands,
} from "../contract";
import { React } from "./react";

const labels: Record<OutputCommand, string> = {
  map: "Map warehouse",
  verify: "Verify project",
  drift: "Check drift",
  inventory: "Refresh tables",
  diagram: "Refresh diagram",
  semantic: "Refresh metrics",
  plans: "Refresh plans",
};

export function commandSummary(commands?: readonly OutputCommand[]) {
  if (!commands || commands.length === outputCommandSchema.options.length)
    return "All commands";
  return commands.map((command) => labels[command]).join(", ");
}

export function CommandPicker({
  commands,
  disabled,
  change,
}: {
  commands: OutputCommand[];
  disabled: boolean;
  change: (commands: OutputCommand[]) => void;
}) {
  return (
    <fieldset className="dx-command-picker" disabled={disabled}>
      <legend>Dex commands</legend>
      <div className="dx-actions">
        <button
          type="button"
          onClick={() => change([...outputCommandSchema.options])}
        >
          Select all
        </button>
        <button type="button" onClick={() => change([])}>
          Clear
        </button>
      </div>
      {outputCommandSchema.options.map((command) => (
        <label key={command}>
          <input
            type="checkbox"
            checked={commands.includes(command)}
            onChange={(event) => {
              change(
                event.target.checked
                  ? [...commands, command]
                  : commands.filter((value) => value !== command),
              );
            }}
          />
          <span>
            {labels[command]}
            <small>{outputCommands[command]}</small>
          </span>
        </label>
      ))}
      {commands.length === 0 && (
        <p role="status">Select at least one command.</p>
      )}
    </fieldset>
  );
}
