import type { AdapterDefinition } from "@northgraindata/dsui-adapter-sdk";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

type AnyAdapter = Pick<
  AdapterDefinition<unknown, unknown>,
  | "metadata"
  | "connectionSchema"
  | "connectionMethods"
  | "resources"
  | "actions"
>;

function jsonSchema(schema: unknown): unknown {
  return schema ? zodToJsonSchema(schema as z.ZodTypeAny) : undefined;
}

/** The catalog entry the server serves for an adapter. */
export function catalogEntry(adapter: AnyAdapter) {
  const { metadata } = adapter;
  return {
    id: metadata.id,
    name: metadata.name,
    version: metadata.version,
    author: metadata.author,
    description: metadata.description ?? "",
    iconUrl: metadata.iconUrl,
    presentation: metadata.presentation,
    status: "ok" as const,
    connectionSchema: jsonSchema(adapter.connectionSchema),
    connectionMethods: adapter.connectionMethods?.map((method) => ({
      id: method.id,
      label: method.label,
      description: method.description,
      group: method.group,
      schema: jsonSchema(method.schema),
    })),
    resources: adapter.resources.map(({ id }) => ({ id })),
    actions: adapter.actions.map(({ id }) => ({ id })),
  };
}
