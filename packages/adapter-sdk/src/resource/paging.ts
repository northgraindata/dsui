import { z } from "zod";

/**
 * What the browser sends to a resource behind a paged `List` or `Table`.
 * Extend it with one field for each filter the component declares.
 */
export const pageInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  search: z.string().max(200).default(""),
});

export type PageQuery = z.output<typeof pageInput>;

/** What such a resource returns: one page, and how many records match. */
export interface Page<T> {
  items: T[];
  total: number;
}
