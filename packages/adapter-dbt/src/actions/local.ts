import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "../context.js";

export const executeInput = z.object({
  command: z.enum(["run", "build", "test", "compile", "docs-generate"]),
  select: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  fullRefresh: z.boolean().default(false),
});

export const execute = defineAction({
  id: "execute",
  input: executeInput,
  run: async (input, ctx: DbtContext & ActionRuntimeContext) => {
    if (!ctx.local)
      throw new Error(
        "This action is available for dbt Local connections only",
      );
    const result = await ctx.local.execute(input.command, input, ctx.signal);
    if (result.exitCode !== 0)
      throw new Error(
        result.stderr ||
          `${input.command} failed with exit code ${result.exitCode}`,
      );
    return { ...result, runId: "local-latest" };
  },
});
