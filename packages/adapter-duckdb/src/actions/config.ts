import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { overview } from "../resources/catalog.js";
import {
  extensionDetails,
  extensions as extensionsResource,
  secrets,
  settings,
} from "../resources/config.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

export const installExtensionInput = z.object({
  name: z.string().min(1),
  repository: z.string().optional(),
});

export const installExtension = defineAction({
  id: "install-extension",
  input: installExtensionInput,
  run: async ({ name, repository }, ctx: Ctx) => {
    await ctx.client.installExtension(name, repository);
    ctx.invalidate(extensionsResource);
    ctx.invalidate(extensionDetails);
    ctx.invalidate(overview);
    return { name, installed: true };
  },
});

export const loadExtensionInput = z.object({ name: z.string().min(1) });

export const loadExtension = defineAction({
  id: "load-extension",
  input: loadExtensionInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.loadExtension(name);
    ctx.invalidate(extensionsResource);
    ctx.invalidate(extensionDetails);
    return { name, loaded: true };
  },
});

export const restartExtension = defineAction({
  id: "restart-extension",
  input: z.object({
    name: z.string().min(1),
    mode: z.enum(["unload", "reload"]),
    confirmed: z.literal(true),
  }),
  run: async ({ name, mode }, ctx: Ctx) => {
    ctx.signal?.throwIfAborted();
    await ctx.client.restartExtension(name, mode);
    ctx.invalidate(extensionsResource);
    ctx.invalidate(extensionDetails);
    ctx.invalidate(overview);
    return { name, loaded: mode === "reload", restarted: true };
  },
});

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
