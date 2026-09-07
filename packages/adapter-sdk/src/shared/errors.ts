/**
 * SDK error taxonomy.
 *
 * All errors thrown by `defineX` constructors and the runtime extend
 * {@link SdkError}, so adapters and renderers can distinguish SDK misuse
 * (`code` checks) from external failures (client errors, which propagate
 * untouched inside error results instead of being thrown).
 */

/**
 * Base class for every error the SDK itself throws.
 *
 * @example
 * ```ts
 * try {
 *   defineAdapter({ metadata: { id: "Bad Id", name: "X", version: "1.0.0" } });
 * } catch (error) {
 *   if (error instanceof SdkError) console.error(error.code, error.message);
 * }
 * ```
 */
export class SdkError extends Error {
  /**
   * Machine-readable failure kind, e.g. `"INVALID_DEFINITION"`.
   * Stable across releases; messages are human-readable and may change.
   */
  readonly code: string;

  /**
   * @param code - Stable machine-readable kind.
   * @param message - Human-readable detail.
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = "SdkError";
    this.code = code;
  }
}

/**
 * A `defineX` call failed validation: bad ids, versions, intervals,
 * duplicate members, or malformed options.
 *
 * @example
 * ```ts
 * defineResource({ id: "", query: () => [] });
 * // throws InvalidDefinitionError: Resource id must be a non-empty string
 * ```
 */
export class InvalidDefinitionError extends SdkError {
  /**
   * @param message - What is invalid and how to fix it.
   */
  constructor(message: string) {
    super("INVALID_DEFINITION", message);
    this.name = "InvalidDefinitionError";
  }
}

/**
 * No page definition matches a requested URL.
 *
 * @example
 * ```ts
 * instance.createPageScope("/no-such-route");
 * // throws UnknownPageError: No page matches URL: /no-such-route
 * ```
 */
export class UnknownPageError extends SdkError {
  /**
   * @param url - The URL that matched nothing.
   */
  constructor(url: string) {
    super("UNKNOWN_PAGE", `No page matches URL: ${url}`);
    this.name = "UnknownPageError";
  }
}
