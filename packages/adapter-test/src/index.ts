import {
  ADAPTER_SDK_VERSION,
  type AdapterDefinition,
  type AdapterInstance,
  type z,
} from "@northgraindata/dsui-adapter-sdk";

export interface ConformanceResult {
  name: string;
  ok: boolean;
  error?: string;
}
export async function checkAdapter<T extends z.ZodTypeAny>(
  adapter: AdapterDefinition<T>,
  connection: unknown,
): Promise<ConformanceResult[]> {
  const checks: Array<() => Promise<void>> = [
    async () => {
      if (adapter.sdkVersion !== ADAPTER_SDK_VERSION)
        throw new Error("SDK version mismatch");
    },
    async () => {
      adapter.connectionSchema.parse(connection);
    },
    async () => {
      if (
        new Set(adapter.capabilities.map((c) => c.id)).size !==
        adapter.capabilities.length
      )
        throw new Error("Duplicate capability ids");
    },
    async () => {
      for (const c of adapter.capabilities)
        if (c.view.kind === undefined || !c.view.title)
          throw new Error(`Invalid view for ${c.id}`);
    },
  ];
  const results: ConformanceResult[] = [];
  for (const check of checks) {
    try {
      await check();
      results.push({ name: check.toString().slice(0, 40), ok: true });
    } catch (error) {
      results.push({
        name: check.toString().slice(0, 40),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

export async function withAdapter<T extends z.ZodTypeAny, R>(
  adapter: AdapterDefinition<T>,
  connection: z.output<T>,
  run: (instance: AdapterInstance) => Promise<R>,
): Promise<R> {
  const instance = adapter.create({}, connection);
  try {
    return await run(instance);
  } finally {
    await instance.close?.();
  }
}
