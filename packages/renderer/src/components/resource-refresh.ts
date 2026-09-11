import type { ResourceReference } from "@northgraindata/dsui-adapter-sdk";

/** Executes a serialized resource reference once and returns a cleanup hook. */
export function watchResource(
  reference: ResourceReference,
  execute: (reference: ResourceReference) => Promise<unknown>,
  onData: (data: unknown) => void,
  onError: (cause: unknown) => void,
): () => void {
  let active = true;
  const load = async () => {
    if (!active) return;
    try {
      const data = await execute(reference);
      if (active) onData(data);
    } catch (cause) {
      if (active) onError(cause);
    }
  };

  void load();
  return () => {
    active = false;
  };
}
