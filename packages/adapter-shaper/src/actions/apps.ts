import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";

type Ctx = ShaperContext & ActionRuntimeContext;

/** Folder paths are `/`-delimited and always start and end with a slash. */
export function normalizeFolderPath(value: string): string {
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.some((part) => part === "." || part === ".."))
    throw new Error("Folder paths cannot contain . or .. segments");
  return parts.length === 0 ? "/" : `/${parts.join("/")}/`;
}

const folderPath = z
  .string()
  .default("/")
  .transform((value, context) => {
    try {
      return normalizeFolderPath(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid path",
      });
      return z.NEVER;
    }
  });

const appType = z.enum(["dashboard", "task"]);

export const createAppInput = z.object({
  type: appType,
  name: z.string().trim().min(1, "A name is required"),
  path: folderPath,
  content: z.string().min(1, "SQL is required"),
});

export const createApp = defineAction({
  id: "create-app",
  input: createAppInput,
  run: async (input, ctx: Ctx) => {
    const [result] = await ctx.client.deploy(
      [
        {
          operation: "create",
          type: input.type,
          data: { name: input.name, path: input.path, content: input.content },
        },
      ],
      ctx.signal,
    );
    if (!result?.id) throw new Error("Shaper did not return the new app id");
    ctx.invalidate();
    return { id: result.id, type: input.type };
  },
});

export const updateAppInput = z.object({
  id: z.string().min(1),
  type: appType,
  name: z.string().trim().min(1).optional(),
  path: folderPath.optional(),
  content: z.string().min(1).optional(),
});

export const updateApp = defineAction({
  id: "update-app",
  input: updateAppInput,
  run: async ({ id, type, name, path, content }, ctx: Ctx) => {
    if (name === undefined && path === undefined && content === undefined)
      throw new Error("Nothing to update");
    await ctx.client.deploy(
      [
        {
          operation: "update",
          type,
          data: {
            id,
            ...(name !== undefined ? { name } : {}),
            ...(path !== undefined ? { path } : {}),
            ...(content !== undefined ? { content } : {}),
          },
        },
      ],
      ctx.signal,
    );
    ctx.invalidate();
    return { id, type };
  },
});

export const deleteAppInput = z.object({
  id: z.string().min(1),
  type: appType,
});

export const deleteApp = defineAction({
  id: "delete-app",
  input: deleteAppInput,
  run: async ({ id, type }, ctx: Ctx) => {
    await ctx.client.deploy(
      [{ operation: "delete", type, data: { id } }],
      ctx.signal,
    );
    ctx.invalidate();
    return { id, type };
  },
});

export const validateDashboardInput = z.object({ sql: z.string().min(1) });

/** Dry run: Shaper evaluates the dashboard queries without saving anything. */
export const validateDashboard = defineAction({
  id: "validate-dashboard",
  input: validateDashboardInput,
  run: ({ sql }, ctx: Ctx) => ctx.client.validateDashboard(sql, ctx.signal),
});
