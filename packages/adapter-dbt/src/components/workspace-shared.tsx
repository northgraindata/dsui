import { type ComponentClient, z } from "@northgraindata/dsui-adapter-sdk";
import { Button, Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { WorkspaceSource } from "./workspace";
export const sourceSchema = z.object({
  resourceId: z.string(),
  input: z.record(z.unknown()).optional(),
});
export const modelRowSchema = z.object({
  uniqueId: z.string(),
  name: z.string(),
  package: z.string(),
  database: z.string(),
  schema: z.string(),
  materialized: z.string(),
  description: z.string(),
  dependsOn: z.array(z.string()),
  location: z.string(),
  upstreamLabel: z.string(),
});
export type ModelRow = z.infer<typeof modelRowSchema>;
export const modelDetailSchema = z.object({
  uniqueId: z.string(),
  name: z.string(),
  description: z.string(),
  database: z.string(),
  schema: z.string(),
  alias: z.string(),
  compiledCode: z.string(),
  rawCode: z.string(),
  dependencies: z.array(z.string()),
  columns: z.array(
    z.object({
      name: z.string(),
      dataType: z.string(),
      description: z.string(),
    }),
  ),
});
export type ModelDetail = z.infer<typeof modelDetailSchema>;
export function useWorkspaceResource<T>(
  client: ComponentClient,
  source: WorkspaceSource,
  schema: z.ZodType<T>,
) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(source);
  useEffect(() => {
    let active = true;
    setResult({});
    void client
      .executeResource(JSON.parse(key))
      .then((value) => schema.parse(value))
      .then((data) => {
        if (active) setResult({ data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            error:
              error instanceof Error
                ? error.message
                : "Could not load dbt data.",
          });
      });
    return () => {
      active = false;
    };
  }, [client, key, schema, revision]);
  return { ...result, retry: () => setRevision((value) => value + 1) };
}
export function ResourceNotice({
  error,
  retry,
  label,
}: {
  error?: string;
  retry: () => void;
  label: string;
}) {
  return (
    <Surface
      className="dbt-notice"
      role={error ? "alert" : "status"}
      aria-busy={!error}
    >
      <strong>{error ? `Could not load ${label}` : `Loading ${label}…`}</strong>
      {error && (
        <>
          <p>{error}</p>
          <Button variant="secondary" size="small" onClick={retry}>
            Try again
          </Button>
        </>
      )}
    </Surface>
  );
}
export function WorkspaceTabs<T extends string>({
  id,
  items,
  value,
  onChange,
  label,
}: {
  id: string;
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="dbt-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${id}-${item.id}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % items.length
                : event.key === "ArrowLeft"
                  ? (index + items.length - 1) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : undefined;
            if (next === undefined) return;
            event.preventDefault();
            onChange(items[next].id);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
