import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { settings } from "../resources/config.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

export const setSettingInput = z.object({
  name: z.string().min(1),
  value: z.string(),
});

export const setSetting = defineAction({
  id: "set-setting",
  input: setSettingInput,
  run: async ({ name, value }, ctx: Ctx) => {
    await ctx.client.setSetting(name, value);
    ctx.invalidate(settings);
    return { name, value };
  },
});

export const resetSettingInput = z.object({ name: z.string().min(1) });

export const resetSetting = defineAction({
  id: "reset-setting",
  input: resetSettingInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.resetSetting(name);
    ctx.invalidate(settings);
    return { name, reset: true };
  },
});
