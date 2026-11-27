import {
  type OutputCommand,
  outputCommandSchema,
  type ScheduleRule,
  scheduleRuleInputSchema,
  schedulesSchema,
} from "../contract";
import { type Client, useResource } from "./client";
import { CommandPicker, commandSummary } from "./command-picker";
import { when } from "./format";
import { OptionSelect } from "./option-select";
import { React } from "./react";

function label({ rule }: ScheduleRule) {
  return rule.kind === "daily"
    ? `Every day at ${rule.time}`
    : `Every ${rule.intervalMinutes} ${rule.intervalMinutes === 1 ? "minute" : "minutes"}`;
}

function ScheduleForm({
  schedule,
  timeZone,
  saving,
  cancel,
  save,
}: {
  schedule?: ScheduleRule;
  timeZone: string;
  saving: boolean;
  cancel: () => void;
  save: (rule: ScheduleRule["rule"], commands: OutputCommand[]) => void;
}) {
  const [commands, setCommands] = React.useState<OutputCommand[]>([
    ...(schedule?.commands ?? outputCommandSchema.options),
  ]);
  const frequencyId = React.useId();
  const [kind, setKind] = React.useState(schedule?.rule.kind ?? "interval");
  const [interval, setInterval] = React.useState(
    schedule?.rule.kind === "interval"
      ? String(schedule.rule.intervalMinutes)
      : "15",
  );
  const [time, setTime] = React.useState(
    schedule?.rule.kind === "daily" ? schedule.rule.time : "15:00",
  );
  const parsed = scheduleRuleInputSchema.safeParse(
    kind === "daily"
      ? { kind, time }
      : {
          kind,
          intervalMinutes: interval === "" ? undefined : Number(interval),
        },
  );
  return (
    <form
      className="dx-schedule-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.success && commands.length > 0) save(parsed.data, commands);
      }}
    >
      <div className="dx-field">
        <label htmlFor={frequencyId}>Frequency</label>
        <OptionSelect
          id={frequencyId}
          value={kind}
          disabled={saving}
          options={[
            { value: "interval", label: "Every N minutes" },
            { value: "daily", label: "Every day at" },
          ]}
          onValueChange={(value) =>
            setKind(value === "daily" ? "daily" : "interval")
          }
        />
      </div>
      {kind === "interval" ? (
        <label>
          Minutes
          <input
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={interval}
            disabled={saving}
            onChange={(event) => setInterval(event.target.value)}
          />
        </label>
      ) : (
        <label>
          Time ({timeZone})
          <input
            type="time"
            required
            value={time}
            disabled={saving}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
      )}
      <CommandPicker
        commands={commands}
        disabled={saving}
        change={setCommands}
      />
      <div className="dx-actions">
        <button
          type="submit"
          className="dx-primary"
          disabled={saving || !parsed.success || commands.length === 0}
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
        <button type="button" disabled={saving} onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Schedules({
  client,
  projectId,
  changed,
}: {
  client: Client;
  projectId: string;
  changed: () => void;
}) {
  const schedules = useResource(
    client,
    "schedules",
    { projectId },
    schedulesSchema,
  );
  const [editor, setEditor] = React.useState<ScheduleRule | "new">();
  const [removing, setRemoving] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const data = schedules.data;

  const update = async (
    actionId: "save-schedule" | "delete-schedule",
    input: object,
  ) => {
    setSaving(true);
    setError(undefined);
    try {
      const result = await client.executeAction({
        actionId,
        input: { projectId, ...input },
      });
      if (result.status !== "success")
        throw new Error(result.message ?? "Could not update the schedule");
      schedules.reload();
      changed();
      setEditor(undefined);
      setRemoving(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the schedule",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dx-panel" aria-label="Schedules">
      <div className="dx-heading">
        <h3>Schedules</h3>
        <button
          type="button"
          disabled={!data || !!editor || saving}
          onClick={() => {
            setError(undefined);
            setRemoving(undefined);
            setEditor("new");
          }}
        >
          Add schedule
        </button>
      </div>
      {schedules.error && (
        <p role="alert" className="dx-error">
          {schedules.error}
        </p>
      )}
      {error && (
        <p role="alert" className="dx-error">
          {error}
        </p>
      )}
      {data && editor && (
        <ScheduleForm
          key={editor === "new" ? "new" : editor.id}
          schedule={editor === "new" ? undefined : editor}
          timeZone={data.timeZone}
          saving={saving}
          cancel={() => setEditor(undefined)}
          save={(rule, commands) =>
            void update(
              "save-schedule",
              editor === "new"
                ? { rule, commands, enabled: true }
                : { id: editor.id, rule, commands, enabled: editor.enabled },
            )
          }
        />
      )}
      {data?.rules.length === 0 && !editor && <p>No scheduled runs.</p>}
      {!data && !schedules.error && <p role="status">Loading schedules…</p>}
      {!!data?.rules.length && (
        <ul className="dx-schedule-list">
          {data.rules.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{label(item)}</strong>
                <p>{commandSummary(item.commands)}</p>
                <p>
                  {item.nextRunAt
                    ? `Next: ${when(item.nextRunAt, data.timeZone)}`
                    : "Paused"}
                </p>
              </div>
              <div className="dx-actions">
                {removing === item.id ? (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void update("delete-schedule", { id: item.id })
                      }
                    >
                      Confirm removal
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setRemoving(undefined)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={saving || !!editor}
                      onClick={() => {
                        setRemoving(undefined);
                        setEditor(item);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving || !!editor}
                      onClick={() =>
                        void update("save-schedule", {
                          id: item.id,
                          rule: item.rule,
                          enabled: !item.enabled,
                        })
                      }
                    >
                      {item.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      disabled={saving || !!editor}
                      onClick={() => setRemoving(item.id)}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
