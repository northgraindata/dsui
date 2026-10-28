import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import type { SuppressionView } from "../contract";
import { React } from "../react";
import { dateTime, fromInputValue, toInputValue, until } from "./format";
import { useAction } from "./hooks";
import { Empty, Notice } from "./parts";

type Client = ComponentProps["client"];

export function SuppressionList({
  client,
  items,
  now,
  onChange,
  showService,
}: {
  client: Client;
  items: readonly SuppressionView[];
  now: number;
  onChange: () => void;
  showService: boolean;
}) {
  const remove = useAction(client, onChange);
  if (items.length === 0)
    return <Empty>No maintenance windows or silences scheduled.</Empty>;
  return (
    <>
      {remove.error && <Notice tone="error">{remove.error}</Notice>}
      <div className="h-table-wrap">
        <table className="h-table">
          <thead>
            <tr>
              <th scope="col">Type</th>
              {showService && <th scope="col">Service</th>}
              <th scope="col">When</th>
              <th scope="col">Reason</th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const live = item.startsAt <= now && item.endsAt > now;
              return (
                <tr key={item.id}>
                  <td>
                    {item.kind === "maintenance" ? "Maintenance" : "Silence"}
                    <span className="h-since">
                      {live
                        ? "Active now"
                        : `Starts ${until(item.startsAt, now)}`}
                    </span>
                  </td>
                  {showService && <td>{item.serviceName ?? "All services"}</td>}
                  <td className="h-num">
                    {dateTime(item.startsAt)} to {dateTime(item.endsAt)}
                  </td>
                  <td className="h-clip" title={item.reason ?? undefined}>
                    {item.reason ?? "—"}
                  </td>
                  <td className="h-right">
                    <button
                      type="button"
                      className="h-button"
                      data-variant="danger"
                      disabled={remove.pending}
                      onClick={() =>
                        void remove.run("delete-suppression", { id: item.id })
                      }
                    >
                      {live ? "End" : "Remove"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Schedules maintenance (excluded from uptime) or a silence (alerts only). */
export function SuppressionForm({
  client,
  services,
  serviceId,
  onCreated,
}: {
  client: Client;
  /** Choices when the form is not tied to one service. */
  services?: ReadonlyArray<{ id: string; name: string }>;
  serviceId?: string;
  onCreated: () => void;
}) {
  const { useState } = React;
  const start = Math.floor(Date.now() / 60_000) * 60_000;
  const [kind, setKind] = useState<"maintenance" | "silence">("maintenance");
  const [target, setTarget] = useState(serviceId ?? "");
  const [startsAt, setStartsAt] = useState(toInputValue(start));
  const [endsAt, setEndsAt] = useState(toInputValue(start + 60 * 60_000));
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string>();
  const action = useAction(client, () => {
    setReason("");
    onCreated();
  });

  return (
    <form
      className="h-form"
      onSubmit={(event) => {
        event.preventDefault();
        const from = fromInputValue(startsAt);
        const to = fromInputValue(endsAt);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
          setInvalid("The end must be after the start.");
          return;
        }
        setInvalid(undefined);
        void action.run("create-suppression", {
          kind,
          serviceId: serviceId ?? (target === "" ? null : target),
          startsAt: from,
          endsAt: to,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        });
      }}
    >
      <label className="h-field">
        Type
        <select
          value={kind}
          onChange={(event) =>
            setKind(
              event.target.value === "silence" ? "silence" : "maintenance",
            )
          }
        >
          <option value="maintenance">
            Maintenance (not counted as downtime)
          </option>
          <option value="silence">Silence (mute incidents and signals)</option>
        </select>
      </label>
      {services && !serviceId && (
        <label className="h-field">
          Service
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="h-field">
        Starts
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
      </label>
      <label className="h-field">
        Ends
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />
      </label>
      <label className="h-field h-grow">
        Reason
        <input
          value={reason}
          maxLength={500}
          placeholder="Optional"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="h-button"
        data-variant="primary"
        disabled={action.pending}
      >
        {action.pending ? "Scheduling…" : "Schedule"}
      </button>
      {(invalid || action.error) && (
        <Notice tone="error">{invalid ?? action.error}</Notice>
      )}
    </form>
  );
}
