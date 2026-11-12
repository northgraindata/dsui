import { randomBytes } from "node:crypto";
import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";

type Ctx = ShaperContext & ActionRuntimeContext;

export const shareInput = z.object({
  id: z.string().min(1),
  visibility: z.enum(["private", "public", "password-protected"]),
  /** Chosen by the user; generated when sharing with a password and omitted. */
  password: z.string().min(8, "Use at least 8 characters").optional(),
});

/** Where Shaper serves a dashboard, and the id an embed needs. */
export function dashboardLink(baseUrl: string, id: string): string {
  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/dashboards/${encodeURIComponent(id)}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

/**
 * Changes who can open a dashboard and returns the link to share.
 *
 * A generated password is returned once: Shaper stores only a hash and never
 * shows it again.
 */
export const shareDashboard = defineAction({
  id: "share-dashboard",
  description:
    "Change who can open a Shaper dashboard and get the link to share. visibility is private, public or password-protected. Public exposes the dashboard to anyone with the link, so ask the user to confirm before using it. For password-protected, pass a password only if the user gave one; otherwise omit it and a password is generated and returned once as generatedPassword. Always give the user the url and, if present, the generatedPassword. Needs a Shaper user on the connection.",
  input: shareInput,
  run: async ({ id, visibility, password }, ctx: Ctx) => {
    if (visibility !== "private") {
      const system = await ctx.client.getSystemConfig(ctx.signal);
      if (visibility === "public" && !system.publicSharingEnabled)
        throw new Error("Public sharing is disabled on this Shaper server");
      if (
        visibility === "password-protected" &&
        !system.passwordProtectedSharingEnabled
      )
        throw new Error(
          "Password-protected sharing is disabled on this Shaper server",
        );
    }
    const secret =
      visibility === "password-protected"
        ? (password ?? randomBytes(12).toString("base64url"))
        : undefined;
    await ctx.client.shareDashboard(
      id,
      { visibility, ...(secret ? { password: secret } : {}) },
      ctx.signal,
    );
    ctx.invalidate();
    return {
      id,
      visibility,
      navigation: [
        {
          label: "Open dashboard in DSUI",
          path: `/dashboards/${encodeURIComponent(id)}`,
        },
      ],
      ...(visibility === "private"
        ? {}
        : { url: dashboardLink(ctx.config.baseUrl, id) }),
      ...(secret && password === undefined
        ? { generatedPassword: secret }
        : {}),
    };
  },
});
