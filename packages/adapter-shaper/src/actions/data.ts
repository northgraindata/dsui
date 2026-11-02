import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";

type Ctx = ShaperContext & ActionRuntimeContext;

export const exportInput = z.object({
  id: z.string().min(1),
  format: z.enum(["pdf", "png", "csv", "xlsx", "json"]),
});

/**
 * Prepares a one-time download link for a dashboard export.
 *
 * Shaper issues the link and renders the file when it is opened, so PDF and
 * PNG generation does not hold this request open.
 */
export const exportDashboard = defineAction({
  id: "export-dashboard",
  input: exportInput,
  run: async ({ id, format }, ctx: Ctx) => ({
    url: await ctx.client.requestDownloadUrl(
      id,
      `dashboard.${format}`,
      ctx.signal,
    ),
  }),
});
