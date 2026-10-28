import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import type { z } from "zod";
import { React } from "../react";

type Client = ComponentProps["client"];

export type Loaded<T> = {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
};

const message = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

/**
 * Reads a plugin resource and keeps it fresh.
 *
 * Responses are parsed with the same schema the server produced them from, so
 * a field that drifts fails loudly here instead of rendering as `undefined`.
 * Every resource this plugin declares reads recorded results, so watching one
 * costs a database read, never a probe.
 */
export function useResource<T>(
  client: Client,
  resourceId: string,
  input: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Loaded<T> {
  const { useCallback, useEffect, useRef, useState } = React;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const reference = useRef({ resourceId, input });
  reference.current = { resourceId, input };
  const key = `${resourceId}:${JSON.stringify(input)}`;

  const apply = useCallback(
    (value: unknown) => {
      try {
        setData(schema.parse(value));
        setError(undefined);
      } catch (cause) {
        setError(message(cause, "Unexpected response."));
      }
    },
    [schema],
  );

  const load = useCallback(() => {
    setLoading(true);
    return client
      .executeResource(reference.current)
      .then(apply)
      .catch((cause: unknown) => setError(message(cause, "Could not load.")))
      .finally(() => setLoading(false));
  }, [client, apply]);

  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    void load();
    const stop = client.watchResource?.(reference.current, (value) => {
      if (active) apply(value);
    });
    return () => {
      active = false;
      stop?.();
    };
  }, [client, key, load, apply]);

  return { data, error, loading, reload: () => void load() };
}

export type ActionState = {
  pending: boolean;
  error: string | undefined;
  run: (actionId: string, input: unknown) => Promise<boolean>;
};

/** Runs actions one at a time and reports the last failure. */
export function useAction(client: Client, onDone?: () => void): ActionState {
  const { useState } = React;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return {
    pending,
    error,
    run: async (actionId, input) => {
      setPending(true);
      setError(undefined);
      try {
        const result = await client.executeAction({ actionId, input });
        if (result.status === "error") {
          setError(result.message ?? "The action failed.");
          return false;
        }
        onDone?.();
        return true;
      } catch (cause) {
        setError(message(cause, "The action failed."));
        return false;
      } finally {
        setPending(false);
      }
    },
  };
}

/** Re-renders on an interval so relative times stay current. */
export function useNow(intervalMs = 30_000): number {
  const { useEffect, useState } = React;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
