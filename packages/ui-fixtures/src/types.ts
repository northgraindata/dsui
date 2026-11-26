/** Data states every page is rendered in. */
export const SCENARIOS = [
  "default",
  "empty",
  "loading",
  "error",
  "large",
  "long-text",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

/** How sampled data is shaped for a scenario that carries data. */
export interface Shape {
  /** Items in each top-level list. */
  readonly rows: number;
  /** Stretches strings to expose wrapping and overflow bugs. */
  readonly longText: boolean;
}

/**
 * Hand-written knowledge an adapter's pages need beyond their types.
 * Everything not listed here is generated from resource output types.
 */
export interface AdapterFixtures {
  /** Values for `:segments` in page paths, shared by all pages. */
  readonly params?: Readonly<Record<string, string>>;
  /** Query string per page path. */
  readonly queries?: Readonly<Record<string, string>>;
  /** Replaces generated data for a resource id. */
  readonly resources?: Readonly<Record<string, (shape: Shape) => unknown>>;
}

export function defineFixtures(fixtures: AdapterFixtures): AdapterFixtures {
  return fixtures;
}
