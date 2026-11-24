import { z } from "zod";
import { InvalidDefinitionError } from "../shared/errors";

/**
 * Upper bounds the host enforces on both sides of the adapter process
 * boundary, so a misbehaving adapter cannot flood a plugin and a plugin
 * cannot ask one adapter for an unbounded amount of work.
 */
export const DATASET_LIST_MAX_LIMIT = 1_000;
export const DATASET_OBSERVE_MAX_REFS = 500;

/**
 * Names one dataset inside one service.
 *
 * `name` is whatever the system itself calls the thing: `analytics.public.orders`
 * for a table, `landing/orders/` for an object prefix, `orders_daily` for an
 * asset. It is unique within a service, which is all a monitor needs, because a
 * monitor always belongs to one service.
 *
 * `namespace` is optional and unset by default. It exists so that identity
 * across services (a dbt model, the table it builds and an orchestrator asset
 * being the same dataset) can be added later without changing this type.
 */
export const datasetRefSchema = z.object({
  namespace: z.string().min(1).max(512).optional(),
  name: z.string().min(1).max(512),
});
export type DatasetRef = z.infer<typeof datasetRefSchema>;

/**
 * Open string, like a health check id: the host and the plugins never branch on
 * it. Well-known values are `table`, `view`, `materialized-view`, `file-set`,
 * `model` and `asset`; an adapter reporting `topic` needs no change anywhere.
 */
export const datasetKindSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "Dataset kind must be kebab-case")
  .max(64);

export const datasetColumnSchema = z.object({
  name: z.string().min(1).max(512),
  /** The type as the system spells it, for example `timestamp with time zone`. */
  type: z.string().max(256).optional(),
  nullable: z.boolean().optional(),
});
export type DatasetColumn = z.infer<typeof datasetColumnSchema>;

export const datasetInfoSchema = z.object({
  ref: datasetRefSchema,
  kind: datasetKindSchema,
  title: z.string().max(512).optional(),
  columns: z.array(datasetColumnSchema).max(5_000).optional(),
});
export type DatasetInfo = z.infer<typeof datasetInfoSchema>;

export const datasetListInputSchema = z.object({
  cursor: z.string().max(2_048).optional(),
  limit: z.number().int().min(1).max(DATASET_LIST_MAX_LIMIT).default(500),
});
export type DatasetListInput = z.input<typeof datasetListInputSchema>;

export const datasetPageSchema = z.object({
  items: z.array(datasetInfoSchema).max(DATASET_LIST_MAX_LIMIT),
  nextCursor: z.string().max(2_048).optional(),
});
export type DatasetPage = z.infer<typeof datasetPageSchema>;

const isoTime = z.string().datetime({ offset: true });

/**
 * One measurement of a dataset. Every measure is optional, because systems
 * differ in what they can tell cheaply: a plugin must treat an absent measure
 * as "not reported", never as zero.
 */
export const datasetObservationSchema = z.object({
  ref: datasetRefSchema,
  /** When the adapter took the measurement. */
  at: isoTime,
  rowCount: z.number().int().min(0).optional(),
  /** False when `rowCount` is a statistic or an estimate rather than a count. */
  rowCountExact: z.boolean().optional(),
  bytes: z.number().int().min(0).optional(),
  /** When the data last changed, for systems that record it. */
  lastModifiedAt: isoTime.optional(),
  /**
   * A value that never decreases and grows with every write, for systems that
   * record no modification time. A consumer derives "changed since the last
   * look" from it; the number itself means nothing.
   */
  changeCounter: z.number().int().min(0).optional(),
  columns: z.array(datasetColumnSchema).max(5_000).optional(),
});
export type DatasetObservation = z.infer<typeof datasetObservationSchema>;

export const datasetObserveInputSchema = z.object({
  refs: z.array(datasetRefSchema).min(1).max(DATASET_OBSERVE_MAX_REFS),
});
export type DatasetObserveInput = z.infer<typeof datasetObserveInputSchema>;

export const datasetObservationsSchema = z
  .array(datasetObservationSchema)
  .max(DATASET_OBSERVE_MAX_REFS);

/**
 * What an adapter offers when it can describe the data it holds.
 *
 * Both reads are cheap by contract: `list` and `observe` answer from the
 * system's own catalog or statistics and must not scan the data. A system that
 * cannot do that for a dataset reports the measures it can and omits the rest.
 * Neither may change anything in the connected system.
 */
export interface DatasetsCapability<TContext = unknown> {
  /** Page through every dataset the connection can see. */
  list(
    input: { cursor?: string; limit: number },
    ctx: TContext,
  ): Promise<DatasetPage> | DatasetPage;
  /**
   * Measure the given datasets in one call. A dataset that no longer exists is
   * left out of the result rather than failing the call.
   */
  observe(
    refs: readonly DatasetRef[],
    ctx: TContext,
  ): Promise<readonly DatasetObservation[]> | readonly DatasetObservation[];
}

/** Declares the dataset capability; a typed identity function like `defineSignal`. */
export function defineDatasets<TContext = unknown>(
  capability: DatasetsCapability<TContext>,
): DatasetsCapability<TContext> {
  if (
    !capability ||
    typeof capability.list !== "function" ||
    typeof capability.observe !== "function"
  )
    throw new InvalidDefinitionError(
      "Datasets capability requires list and observe functions",
    );
  return capability;
}
