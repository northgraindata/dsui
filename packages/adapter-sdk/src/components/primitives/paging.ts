export interface ServerFilter {
  /** The resource input field that receives the choice. */
  param: string;
  /** Shown when nothing is chosen, such as "All states". */
  label: string;
  options: readonly { label: string; value: string }[];
}

/**
 * Makes the source answer one page at a time. Its input must accept
 * `pageInput` and its result must be a `Page`.
 */
export interface ServerPagination {
  /** Adds a search box whose text is sent as `search`. */
  search?: string;
  filters?: readonly ServerFilter[];
  /** Rows on each page; 25 when omitted, at most 100. */
  pageSize?: number;
}
