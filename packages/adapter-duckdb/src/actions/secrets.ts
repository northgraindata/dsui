import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { secrets } from "../resources/secrets.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

export const createSecretInput = z.object({
  type: z.string().min(1),
  keyId: z.string().optional(),
  secret: z.string().min(1),
  region: z.string().optional(),
  endpoint: z.string().optional(),
  scope: z.string().optional(),
});

export const createSecret = defineAction({
  id: "create-secret",
  input: createSecretInput,
  run: async (input, ctx: Ctx) => {
    await ctx.client.createSecret(input);
    ctx.invalidate(secrets);
    return { created: true };
  },
});

export const dropSecretInput = z.object({ name: z.string().min(1) });

export const dropSecret = defineAction({
  id: "drop-secret",
  input: dropSecretInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.dropSecret(name);
    ctx.invalidate(secrets);
    return { name, dropped: true };
  },
});
