import {
  type ActionRuntimeContext,
  defineAction,
  defineAdapter,
  defineResource,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { createDbtContext } from "./backend.js";
import {
  type DbtConfig,
  dbtConnectionMethods,
  getDbtReadiness,
} from "./context.js";

type RuntimeContext = ReturnType<typeof createDbtContext>;
type ActionContext = RuntimeContext & ActionRuntimeContext;

export const metadata = defineResource({
  id: "metadata",
  query: (_, ctx: RuntimeContext) => ctx.backend.metadata,
});

export const readiness = defineResource({
  id: "readiness",
  query: (_, ctx: RuntimeContext) => getDbtReadiness(ctx.config),
});

const actionInput = z.record(z.unknown());

function providerAction(id: string) {
  return defineAction({
    id,
    input: actionInput,
    run: (input, ctx: ActionContext) =>
      ctx.backend.executeAction(id, input, ctx.signal),
  });
}

export const run = providerAction("run");
export const build = providerAction("build");
export const test = providerAction("test");
export const compile = providerAction("compile");
export const generateDocs = providerAction("docs-generate");
export const cancel = providerAction("cancel");
export const retry = providerAction("retry");

export function createDbtAdapter() {
  return defineAdapter<RuntimeContext, DbtConfig>({
    metadata: {
      id: "dbt",
      name: "dbt",
      version: "0.0.0",
      author: "DSUI",
      description: "Typed dbt Cloud and dbt Local adapter contract.",
    },
    connectionMethods: dbtConnectionMethods,
    context: (config) => createDbtContext(config),
    resources: [metadata, readiness],
    actions: [run, build, test, compile, generateDocs, cancel, retry],
  });
}

export const dbtAdapter = createDbtAdapter();
export default dbtAdapter;
