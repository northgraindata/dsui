import { Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";

function formatValue(value: unknown, format: string | undefined): string {
  if (value === null || value === undefined) return "—";
  if (format === "bytes" && typeof value === "number") {
    if (value < 1024) return `${Math.round(value)} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let amount = value / 1024;
    let unit = 0;
    while (amount >= 1024 && unit < units.length - 1) {
      amount /= 1024;
      unit += 1;
    }
    return `${amount.toFixed(1)} ${units[unit]}`;
  }
  if (format === "number" && typeof value === "number")
    return value.toLocaleString("en-US");
  return String(value);
}

export function ValueView({ client, node, context }: RegistryViewProps) {
  if (node.kind !== "value") return null;
  const [value, setValue] = useState<unknown>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!node.props.source) return;
    let active = true;
    client
      .executeResource(node.props.source)
      .then((result) => {
        if (!active) return;
        if (result && typeof result === "object" && !Array.isArray(result)) {
          setValue((result as Record<string, unknown>)[node.props.field]);
        } else {
          setError("Could not load value");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load value",
          );
      });
    return () => {
      active = false;
    };
  }, [client, node.props.field, node.props.source]);
  if (!node.props.source) {
    const contextValue = resolve(context, node.props.field);
    return (
      <span>
        {contextValue === undefined || contextValue === null
          ? (node.props.fallback ?? "—")
          : formatValue(contextValue, node.props.format)}
      </span>
    );
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
  return <span>{formatValue(value, node.props.format)}</span>;
}

function resolve(
  context: Record<string, unknown> | undefined,
  field: string,
): unknown {
  return field.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object")
      return (current as Record<string, unknown>)[key];
    return undefined;
  }, context);
}
