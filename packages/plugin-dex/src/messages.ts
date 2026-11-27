const MAX_MESSAGE_LENGTH = 1_000;

/**
 * Dex messages name host paths; callers only need the project-relative part.
 * The configured and resolved spellings differ when a link is involved, and the
 * longer goes first because one can contain the other.
 */
export function redactPaths(message: string, paths: readonly string[]): string {
  return [...paths]
    .sort((a, b) => b.length - a.length)
    .reduce((text, path) => text.replaceAll(path, "<project>"), message);
}

export function publicMessage(
  message: string,
  paths: readonly string[],
): string {
  return redactPaths(message, paths).slice(0, MAX_MESSAGE_LENGTH);
}
