/**
 * The read-only Dex results DSUI shows.
 *
 * Schemas follow output captured from Dex 1.19.0 (see `test/fixtures`), not the
 * docs, which publish few payload examples. A payload that stops matching is
 * reported as unrecognized instead of being guessed at.
 */
import { z } from "zod";

export const VIEW_KINDS = [
  "inventory",
  "diagram",
  "semantic",
  "plans",
] as const;
export const viewKindSchema = z.enum(VIEW_KINDS);
export type ViewKind = z.output<typeof viewKindSchema>;

/**
 * Every command DSUI can run. None may carry `--confirm`, `--budget`, a session
 * ceiling or a population-change override: those answer for a person.
 */
export const VIEW_COMMANDS: Record<ViewKind, readonly string[]> = {
  inventory: ["explore", "inventory"],
  diagram: ["explore", "diagram"],
  semantic: ["explore", "semantic", "list"],
  plans: ["transform", "plans"],
};

const inventorySchema = z.object({
  objects: z.array(
    z.object({
      identifier: z.string(),
      object_type: z.string(),
      row_estimate: z.number().nullable(),
      column_count: z.number().nullable(),
    }),
  ),
});

const semanticSchema = z.object({
  metrics: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      label: z.string().nullish(),
      description: z.string().nullish(),
      dimensions: z.array(z.string()).default([]),
    }),
  ),
});

const plansSchema = z.object({
  plans: z.array(
    z.object({
      plan_id: z.string(),
      intent: z.string().nullable(),
      paths: z.array(z.string()),
      created_at: z.string(),
      pending: z.boolean(),
    }),
  ),
});

const diagramSchema = z.object({ mermaid: z.string() });

export type ViewRow = Record<string, string | number | null>;

export type ViewContent =
  | { readonly format: "rows"; readonly rows: readonly ViewRow[] }
  | { readonly format: "mermaid"; readonly mermaid: string }
  | { readonly format: "unrecognized" };

const unrecognized: ViewContent = { format: "unrecognized" };

function rows<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  data: unknown,
  select: (parsed: T) => ViewRow[],
): ViewContent {
  const result = schema.safeParse(data);
  return result.success
    ? { format: "rows", rows: select(result.data) }
    : unrecognized;
}

export function parseView(kind: ViewKind, data: unknown): ViewContent {
  switch (kind) {
    case "inventory":
      return rows(inventorySchema, data, ({ objects }) =>
        objects.map((object) => ({
          object: object.identifier,
          type: object.object_type,
          rows: object.row_estimate,
          columns: object.column_count,
        })),
      );
    case "semantic":
      return rows(semanticSchema, data, ({ metrics }) =>
        metrics.map((metric) => ({
          metric: metric.name,
          type: metric.type,
          label: metric.label ?? "",
          description: metric.description ?? "",
          dimensions: metric.dimensions.join(", "),
        })),
      );
    case "plans":
      return rows(plansSchema, data, ({ plans }) =>
        plans.map((plan) => ({
          plan: plan.plan_id,
          intent: plan.intent ?? "",
          files: plan.paths.join(", "),
          created: plan.created_at,
          state: plan.pending ? "pending" : "applied",
        })),
      );
    case "diagram": {
      const result = diagramSchema.safeParse(data);
      return result.success
        ? { format: "mermaid", mermaid: result.data.mermaid }
        : unrecognized;
    }
  }
}
