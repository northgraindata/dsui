import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { z } from "@northgraindata/dsui-adapter-sdk";
import type { ReactNode } from "react";
import { React } from "./react";
export type Client = ComponentProps["client"];
export type ObjectValue = Record<string, unknown>;
export function object(value: unknown): ObjectValue {
  return z.record(z.unknown()).parse(value ?? {});
}
export function objects(value: unknown): ObjectValue[] {
  return z.array(z.record(z.unknown())).parse(value ?? []);
}
export function text(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function title(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}
export function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
export function useData(
  client: Client,
  resourceId: string,
  input: ObjectValue = {},
  poll = false,
  finished?: (value: unknown) => boolean,
) {
  const [data, setData] = React.useState<unknown>();
  const [error, setError] = React.useState<string>();
  const [refresh, setRefresh] = React.useState(0);
  const key = JSON.stringify(input);
  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setData(undefined);
    setError(undefined);
    const load = async () => {
      if (document.hidden) {
        timer = setTimeout(load, 2000);
        return;
      }
      try {
        const value = await client.executeResource({ resourceId, input });
        if (active) {
          setData(value);
          setError(undefined);
          if (poll && !finished?.(value)) timer = setTimeout(load, 2000);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Resource unavailable",
          );
          if (poll) timer = setTimeout(load, 5000);
        }
      }
    };
    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: input is represented by the serialized key; finish predicate is stable for each resource.
  }, [client, resourceId, key, poll, refresh]);
  return { data, error, reload: () => setRefresh((value) => value + 1) };
}
export function DataTable({
  rows,
  columns,
  onRow,
}: {
  rows: ObjectValue[];
  columns?: string[];
  onRow?: (row: ObjectValue) => void;
}) {
  const keys = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!rows.length) return <p className="tr-empty">No records.</p>;
  return (
    <div className="tr-table">
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{title(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={text(row.queryId ?? row.nodeId ?? row.taskId ?? index)}>
              {keys.map((key, column) => (
                <td key={key}>
                  {onRow && column === 0 ? (
                    <button
                      className="tr-link"
                      type="button"
                      onClick={() => onRow(row)}
                    >
                      {text(row[key])}
                    </button>
                  ) : (
                    text(row[key])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Facts({ value }: { value: unknown }) {
  const data = object(value);
  return (
    <dl className="tr-facts">
      {Object.entries(data).map(([key, value]) => (
        <React.Fragment key={key}>
          <dt>{title(key)}</dt>
          <dd>{text(value)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p className="tr-error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Json({ value }: { value: unknown }) {
  return <pre className="tr-code">{JSON.stringify(value, null, 2)}</pre>;
}
export function Panel({
  title: heading,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="tr-card">
      <h3>{heading}</h3>
      {children}
    </section>
  );
}
