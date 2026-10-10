# SDK changesets

Run `bun run changeset` for public SDK changes. Select the affected SDK, choose patch/minor/major and explain observable behavior and any migration. Adapter SDK and its UI implementation share a fixed version; Plugin SDK has an independent version. Product tags remain independent.

Run `bun run version:sdk` in the release preparation PR, review versions, dependency ranges and changelogs, then merge before creating release tags. See `apps/docs/content/docs/releases.mdx`.
