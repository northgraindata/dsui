/**
 * Whether `value` is a path inside a service workspace.
 *
 * Adapters may offer one for a failing check. Anything that is not a plain
 * local path, including absolute URLs and protocol-relative paths, is
 * rejected so a check can never send a user to another site.
 */
export function isWorkspacePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !Array.from(value).some(
      (character) => character === "\\" || character.charCodeAt(0) < 32,
    )
  );
}
