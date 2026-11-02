import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";
import { summarizeDashboard } from "../dashboard-model.js";

export const dashboardInput = z.object({
  id: z.string().min(1),
  /** JSON object of dashboard variables; a string keeps the URL state simple. */
  variables: z.string().default("{}"),
});

const variablesSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

export function parseVariables(value: string) {
  try {
    const parsed = variablesSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/**
 * Shaper hides query errors from dashboard-scoped tokens, which are the only
 * way an API key can read a dashboard. A dry-run validation with the key
 * itself recovers the real SQL error so the viewer can act on it.
 */
async function explainFailure(
  id: string,
  ctx: ShaperContext,
  original: unknown,
): Promise<Error> {
  try {
    const app = (await ctx.client.listApps()).find(
      (candidate) => candidate.id === id,
    );
    if (app?.content) {
      const result = await ctx.client.validateDashboard(app.content);
      if (!result.valid && result.error)
        return new Error(`Dashboard SQL failed: ${result.error}`);
    }
  } catch {
    // Fall through to the original error.
  }
  return original instanceof Error ? original : new Error("Dashboard failed");
}

/** The dashboard as the server evaluated it, for the browser renderer. */
export const dashboard = defineResource({
  id: "dashboard",
  description:
    "Raw evaluated dashboard for the browser renderer. Prefer dashboard-summary to read numbers.",
  input: dashboardInput,
  query: async ({ id, variables }, ctx: ShaperContext) => {
    try {
      return await ctx.client.getDashboard(id, parseVariables(variables));
    } catch (error) {
      throw await explainFailure(id, ctx, error);
    }
  },
});

/**
 * The numbers on a dashboard in a form that can be quoted: the section and
 * query titles, readable column names and the first rows of each result.
 */
export const dashboardSummary = defineResource({
  id: "dashboard-summary",
  description:
    "Read the values shown on one Shaper dashboard by id: each section's titled queries with column names and rows. Use it to answer questions about a dashboard's numbers. Find ids with the dashboards resource.",
  input: dashboardInput,
  query: async ({ id, variables }, ctx: ShaperContext) => {
    try {
      return summarizeDashboard(
        await ctx.client.getDashboard(id, parseVariables(variables)),
      );
    } catch (error) {
      throw await explainFailure(id, ctx, error);
    }
  },
});
