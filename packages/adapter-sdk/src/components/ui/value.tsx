import { Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { ValueProps } from "../primitives/value";
import { type ComponentProps, componentProps } from "../runtime";

export function Value({ client, node, context }: ComponentProps) {
  const props = componentProps<ValueProps>(node);
  const [value, setValue] = useState<unknown>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!props?.source) return;
    let active = true;
    client
      .executeResource(props.source)
      .then((result) => {
        if (!active) return;
        if (result && typeof result === "object" && !Array.isArray(result))
          setValue((result as Record<string, unknown>)[props.field]);
        else setError("Could not load value");
      })
      .catch(
        (cause) =>
          active &&
          setError(
            cause instanceof Error ? cause.message : "Could not load value",
          ),
      );
    return () => {
      active = false;
    };
  }, [client, props?.field, props?.source]);
  if (!props) return null;
  if (!props.source) {
    const resolved = props.field
      .split(".")
      .reduce<unknown>(
        (current, key) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[key]
            : undefined,
        context,
      );
    return <span>{formatValue(resolved ?? props.fallback, props.format)}</span>;
  }
  if (error)
    return (
      <span className="text-unavailable" role="alert">
        {error}
      </span>
    );
  if (value === undefined)
    return (
      <Surface className="p-0 text-[12px] text-secondary" aria-busy="true">
        Loading…
      </Surface>
    );
  return <span>{formatValue(value, props.format)}</span>;
}

export default Value;

function formatValue(value: unknown, format: ValueProps["format"]): string {
  if (value === null || value === undefined) return "—";
  if (format === "number" && typeof value === "number")
    return value.toLocaleString("en-US");
  if (format === "bytes" && typeof value === "number")
    return `${value.toLocaleString("en-US")} B`;
  return String(value);
}
