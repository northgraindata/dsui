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
} from "../resources/extensions.js";

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
