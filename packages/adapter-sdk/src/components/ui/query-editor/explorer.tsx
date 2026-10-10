import { useEffect, useState } from "react";
import { z } from "zod";
import type { QueryEditorExplorerProps } from "../../primitives/query-editor";
import type { ComponentClient } from "../../runtime";
export function QueryExplorer({
  client,
  definition,
  onSelect,
  context = {},
  labels = [],
}: {
  client: ComponentClient;
  definition: QueryEditorExplorerProps;
  onSelect: (names: string[]) => void;
  context?: Record<string, string>;
  labels?: string[];
}) {
  const [items, setItems] = useState<{ name: string }[]>([]);
  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState<string>();
  const key = JSON.stringify(context);
  useEffect(() => {
    const context = z.record(z.string()).parse(JSON.parse(key));
    let active = true;
    setItems([]);
    setError(undefined);
    const input: Record<string, unknown> = {};
    if (definition.source.input && typeof definition.source.input === "object")
      for (const [name, value] of Object.entries(definition.source.input))
        input[name] =
          typeof value === "string" && value.startsWith("$")
            ? context[value.slice(1)]
            : value;
    void client
      .executeResource({ ...definition.source, input })
      .then((result) => {
        if (!active) return;
        if (!Array.isArray(result))
          throw new Error("Invalid explorer response");
        setItems(
          result.map((value) => {
            if (!value || typeof value !== "object")
              throw new Error("Invalid explorer item");
            const name = Reflect.get(value, definition.nameField ?? "name");
            if (typeof name !== "string")
              throw new Error("Missing explorer name");
            return { name };
          }),
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Explorer unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, [client, definition, key]);
  return (
    <ul style={{ listStyle: "none", paddingLeft: labels.length ? 12 : 0 }}>
      {error && <li role="alert">{error}</li>}
      {items.map((item) => (
        <li key={item.name}>
          <button
            type="button"
            style={{ padding: "7px 4px", textAlign: "left", width: "100%" }}
            onClick={() =>
              definition.children
                ? setExpanded(expanded === item.name ? undefined : item.name)
                : onSelect([...labels, item.name])
            }
          >
            {definition.children
              ? expanded === item.name
                ? "▾ "
                : "▸ "
              : "▤ "}
            {item.name}
          </button>
          {expanded === item.name && definition.children && (
            <QueryExplorer
              client={client}
              definition={definition.children}
              onSelect={onSelect}
              context={{
                ...context,
                name: item.name,
                ...(definition.contextKey
                  ? { [definition.contextKey]: item.name }
                  : {}),
              }}
              labels={[...labels, item.name]}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
