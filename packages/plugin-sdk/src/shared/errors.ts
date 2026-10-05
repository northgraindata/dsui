/**
 * SDK error taxonomy, mirroring the adapter SDK.
 *
 * Errors thrown by `defineX` constructors and the runtime extend
 * {@link SdkError}, so a host can distinguish SDK misuse (a `code` check) from
 * an external failure, which propagates untouched inside a result instead.
 */

/**
 * Base class for every error the SDK itself throws.
 *
 * @example
 * ```ts
 * try {
 *   definePage({ path: "relative", render: () => [] });
 * } catch (error) {
 *   if (error instanceof SdkError) console.error(error.code, error.message);
 * }
 * ```
 */
export class SdkError extends Error {
  /**
   * Machine-readable failure kind, e.g. `"INVALID_DEFINITION"`. Stable across
   * releases; messages are human-readable and may change.
   */
  readonly code: string;

  /**
   * @param code - Stable machine-readable kind.
   * @param message - Human-readable description.
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = "SdkError";
    this.code = code;
  }
}

/**
 * A definition is malformed: a bad id, a relative path, a duplicate member.
 * Raised eagerly by `defineX` so a plugin fails at load rather than at first
 * render.
 */
export class InvalidDefinitionError extends SdkError {
  constructor(message: string) {
    super("INVALID_DEFINITION", message);
    this.name = "InvalidDefinitionError";
  }
}

/** A safe message and HTTP status for plugin callers. Jobs treat this as a permanent failure. */
export class PluginRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 400,
  ) {
    super(message);
    this.name = "PluginRequestError";
  }
}
