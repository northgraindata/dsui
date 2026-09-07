import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { grants, users } from "../resources/governance.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

const userInput = z.object({ name: z.string().min(1) });

export const createUserInput = z.object({
  name: z.string().min(1),
  password: z.string().min(8),
});

export const createUser = defineAction({
  id: "create-user",
  input: createUserInput,
  run: async ({ name, password }, ctx: Ctx) => {
    await ctx.client.createUser({ name, password });
    ctx.invalidate(users);
    return { name };
  },
});

export const suspendUser = defineAction({
  id: "suspend-user",
  input: userInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.suspendUser(name);
    ctx.invalidate(users);
    return { name, status: "SUSPENDED" };
  },
});

export const resumeUser = defineAction({
  id: "resume-user",
  input: userInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.resumeUser(name);
    ctx.invalidate(users);
    return { name, status: "ACTIVE" };
  },
});

const grantInput = z.object({
  privilege: z.string().min(1),
  objectType: z.string().min(1),
  objectName: z.string().min(1),
});

export const grantPrivilegeInput = grantInput.extend({
  to: z.string().min(1),
});

export const revokePrivilegeInput = grantInput.extend({
  from: z.string().min(1),
});

export const grantPrivilege = defineAction({
  id: "grant-privilege",
  input: grantPrivilegeInput,
  run: async (input, ctx: Ctx) => {
    await ctx.client.grantPrivilege(input);
    ctx.invalidate(grants);
    return input;
  },
});

export const revokePrivilege = defineAction({
  id: "revoke-privilege",
  input: revokePrivilegeInput,
  run: async (input, ctx: Ctx) => {
    await ctx.client.revokePrivilege(input);
    ctx.invalidate(grants);
    return input;
  },
});
