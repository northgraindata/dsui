import {
  type AdapterDefinition,
  type AdapterInstance,
  createAdapterInstance,
} from "@northgraindata/dsui-adapter-sdk";

type AdapterRuntimeOptions = NonNullable<
  Parameters<typeof createAdapterInstance>[2]
>;

export interface AdapterTest<TContext> {
  readonly instance: AdapterInstance<TContext>;
  readonly context: TContext;
  dispose(): Promise<void>;
}

/**
 * Creates an isolated adapter instance for framework-agnostic tests.
 *
 * The helper deliberately delegates validation, context creation, stores,
 * resource execution, action execution, and cleanup to the public SDK runtime.
 * It does not start the DSUI server or require a browser renderer.
 */
export async function createAdapterTest<TContext, TConfig>(
  definition: AdapterDefinition<TContext, TConfig>,
  config: unknown = {},
  options?: AdapterRuntimeOptions,
): Promise<AdapterTest<TContext>> {
  const instance = await createAdapterInstance(definition, config, options);
  return {
    instance,
    context: instance.context,
    dispose: () => instance.dispose(),
  };
}

/**
 * Runs a test against an isolated adapter instance and always disposes it.
 */
export async function withAdapterTest<TContext, TConfig, TResult>(
  definition: AdapterDefinition<TContext, TConfig>,
  config: unknown,
  run: (test: AdapterTest<TContext>) => TResult | Promise<TResult>,
  options?: AdapterRuntimeOptions,
): Promise<TResult> {
  const test = await createAdapterTest(definition, config, options);
  try {
    return await run(test);
  } finally {
    await test.dispose();
  }
}
