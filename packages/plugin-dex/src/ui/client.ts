import type { z } from "zod";
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

/** Reads a resource and follows its refresh policy. */
export function useResource<T>(
  client: Client,
  resourceId: string,
  input: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
) {
  // The host rejects an empty body, so no input is sent as an empty object.
  const key = JSON.stringify(input ?? {});
  const [state, setState] = React.useState<{
    key: string;
    data?: T;
    error?: string;
  }>({ key });
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    let receivedWatch = false;
    const reference = { resourceId, input: JSON.parse(key) };
    const accept = (value: unknown) => {
      if (!active) return;
      const result = schema.safeParse(value);
      setState(
        result.success
          ? { key: `${resourceId}${key}`, data: result.data }
          : { key: `${resourceId}${key}`, error: "Unexpected data" },
      );
    };
    void client
      .executeResource(reference)
      .then((value) => {
        if (!receivedWatch) accept(value);
      })
      .catch((cause: unknown) => {
        if (active && !receivedWatch)
          setState({
            key: `${resourceId}${key}`,
            error: cause instanceof Error ? cause.message : "Could not load",
          });
      });
    const unsubscribe = client.watchResource?.(reference, (data) => {
      receivedWatch = true;
      accept(data);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [client, resourceId, key, version]);
  // Data read for another input is never shown while the new one loads.
  const current =
    state.key === `${resourceId}${key}`
      ? state
      : { data: undefined, error: undefined };
  return {
    data: current.data,
    error: current.error,
    reload: () => setVersion((value) => value + 1),
  };
}
