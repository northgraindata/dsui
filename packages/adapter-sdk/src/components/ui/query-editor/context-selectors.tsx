import { useEffect, useState } from "react";
import { z } from "zod";
import type { ResourceReference } from "../../../resource";
import type { QueryEditorProps } from "../../primitives/query-editor";
import type { ComponentClient } from "../../runtime";

export function ContextSelector({
  client,
  selector,
  values,
  change,
}: {
  client: ComponentClient;
  selector: NonNullable<QueryEditorProps["contextSelectors"]>[number];
  values: Record<string, string>;
  change: (name: string, value: string) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const valuesKey = JSON.stringify(values);
  useEffect(() => {
    const values = z.record(z.string()).parse(JSON.parse(valuesKey));
    let active = true;
    setOptions([]);
    setError(undefined);
    if ((selector.dependsOn ?? []).some((name) => !values[name])) return;
    const input = selector.source.input;
    const boundInput: Record<string, unknown> = {};
    if (input && typeof input === "object")
      for (const [key, value] of Object.entries(input))
        boundInput[key] =
          typeof value === "string" && value.startsWith("$")
            ? values[value.slice(1)]
            : value;
    const reference: ResourceReference = {
      ...selector.source,
      input: boundInput,
    };
    void client
      .executeResource(reference)
      .then((result) => {
        if (!active) return;
        if (!Array.isArray(result)) throw new Error("Invalid selector options");
        const names = result.map((item) => {
          if (
            !item ||
            typeof item !== "object" ||
            !("name" in item) ||
            typeof item.name !== "string"
          )
            throw new Error("Invalid selector option");
          return item.name;
        });
        setOptions(names);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load options",
          );
      });
    return () => {
      active = false;
    };
  }, [client, selector, valuesKey]);
  return (
    <label className="query-database-picker">
      <span>{selector.label}</span>
      <select
        value={values[selector.name] ?? ""}
        onChange={(event) => change(selector.name, event.target.value)}
        disabled={
          Boolean(error) ||
          (selector.dependsOn ?? []).some((name) => !values[name])
        }
      >
        <option value="">Configured {selector.label.toLowerCase()}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
