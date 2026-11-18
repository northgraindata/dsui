const GIT_URL_PREFIX = /^git\+https:\/\/github\.com\//u;
const GIT_SUFFIX = /\.git$/u;

/**
 * The `owner/name` of a GitHub repository, from either spelling a config may
 * use: `owner/name` or `git+https://github.com/owner/name`. Returns null for
 * anything else, so each caller words its own error.
 *
 * Adapters and plugins are built from the same kind of source, so they must
 * accept the same spellings.
 */
export function githubRepository(spelling: string): string | null {
  const [owner, name, ...rest] = spelling
    .replace(GIT_URL_PREFIX, "")
    .replace(GIT_SUFFIX, "")
    .split("/");
  return owner && name && rest.length === 0 ? `${owner}/${name}` : null;
}
