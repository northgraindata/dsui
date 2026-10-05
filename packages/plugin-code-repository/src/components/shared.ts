import { z } from "zod";
import { connectionSchema } from "../model";
import { React } from "./react";
export interface Client {
  executeResource(reference: {
    resourceId: string;
    input?: unknown;
  }): Promise<unknown>;
  watchResource?(
    reference: { resourceId: string; input?: unknown },
    listener: (data: unknown) => void,
  ): () => void;
  executeAction(reference: {
    actionId: string;
    input?: unknown;
  }): Promise<{ status: string; data?: unknown; message?: string }>;
  navigate?(path: string): void;
}
export interface Props {
  node: { props: unknown };
  client: Client;
}
export const screenProps = z.object({
  props: z.object({
    serviceId: z.string().optional(),
    connectionId: z.string().optional(),
    path: z.string().optional(),
  }),
});
export const savedConnection = connectionSchema.extend({
  id: z.string().uuid(),
  revision: z.number(),
  status: z.enum(["idle", "queued", "syncing", "ready", "error"]),
  lastAttemptAt: z.string().nullable(),
  lastFetchedAt: z.string().nullable(),
  error: z.string().nullable(),
  version: z.string().nullable(),
});
export const overviewSchema = z.object({
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      adapter: z.string(),
      iconUrl: z.string().optional(),
      connections: z.array(savedConnection),
    }),
  ),
  providers: z.object({
    github: z.boolean(),
    gitlab: z.array(z.object({ id: z.string(), url: z.string() })),
    local: z.boolean(),
  }),
});
export const treeSchema = z.object({
  connection: savedConnection,
  files: z.array(z.object({ path: z.string(), size: z.number() })),
});
export const fileSchema = z.object({
  path: z.string(),
  size: z.number(),
  content: z.string().nullable(),
  reason: z.string().nullable(),
  version: z.string().nullable(),
});

export function useResource(
  client: Client,
  resourceId: string,
  input: unknown,
  enabled = true,
  refresh: string | number = 0,
) {
  const key = JSON.stringify(input);
  const [data, setData] = React.useState<unknown>();
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    if (!enabled) {
      setData(undefined);
      return;
    }
    let active = true;
    setData(undefined);
    setError(undefined);
    const reference = { resourceId, input: JSON.parse(key) };
    void client
      .executeResource(reference)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load code",
          );
      });
    const unsubscribe = client.watchResource?.(reference, (value) => {
      if (active) {
        setData(value);
        setError(undefined);
      }
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [client, resourceId, key, enabled, refresh]);
  return { data, error };
}
export async function action(
  client: Client,
  actionId: string,
  input: unknown,
): Promise<unknown> {
  const result = await client.executeAction({ actionId, input });
  if (result.status !== "success")
    throw new Error(result.message ?? "Repository operation failed");
  return result.data;
}
export function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not fetched yet";
}
