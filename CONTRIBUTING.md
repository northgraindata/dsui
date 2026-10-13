# Contributing to DSUI

Focused issues, reproductions, documentation fixes, and code contributions are
welcome. You do not need an AI tool or agent skills to contribute.

## Read the relevant guidance

- [Adapter SDK docs](https://dsui.northgraindata.com/docs/adapter-sdk/overview): authoring and runtime
  semantics; start new adapters from [the complete example](examples/example-adapter/README.md).

The [`agents/`](agents/README.md) directory provides optional, general engineering
guidance for AI-assisted work.

## Setup and checks

The monorepo uses Bun/Turborepo and TypeScript, Hono/SQLite/Zod on the server,
React 19/Vite/TanStack Router/Tailwind for the app, and Astro for site and docs.
Biome handles formatting and lint; package scripts use Bun Test or Vitest.

Use the Bun version pinned in `package.json` (currently 1.3.12), then run from the
repository root:

```sh
bun install --frozen-lockfile
bun run dev
```

Root checks are:

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

`bun run check` combines lint and typecheck. Run `bun run test` separately. Lint includes Biome formatting
checks; `format:check` runs formatting alone. Build remains separate. Use
`bun run format` to apply formatting, then inspect the diff for unrelated edits.

During iteration, use the affected package's scripts. For example:

```sh
bun run --filter @northgraindata/dsui-adapter-sdk test
bun run --filter @northgraindata/dsui-adapter-sdk typecheck
bun run --filter @northgraindata/dsui-adapter-duckdb test
bun run --filter @northgraindata/dsui-adapter-duckdb typecheck
```

SDK or adapter changes must run SDK tests and affected adapter tests and typechecks.
Host or protocol changes also need server integration checks. Root `test` runs
workspace test scripts; CI additionally runs adapter test files in a separate job.

Run the root checks for code changes before handoff. For documentation-only edits,
check formatting, local links, and any changed commands; build the relevant docs
surface when changing it. Explain any omitted or failing check. CI also checks
delivery artifacts, Docker, Compose, dependencies, and bundle sizes; a local test
run is not a claim that those checks passed.

## Your first contribution

1. Browse [good first issues](https://github.com/northgraindata/dsui/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)
   for a bounded first change, or [help wanted](https://github.com/northgraindata/dsui/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
   for broader work. Documentation, reproductions, and manual verification are welcome too.
2. Comment on the issue before starting so maintainers can confirm the scope and
   avoid overlapping work. Ask questions in that issue; no chat account is required.
3. Fork the repository, clone your fork, and follow the setup above. For an app
   change, run `bun run dev` and use the URLs printed by the development servers.
4. Find the synced Linear ID in the GitHub issue. Use the branch name supplied
   there, or create one such as `fix/dsui-123-wrap-long-values`. If the ID is
   missing, ask a maintainer to add it before opening a PR.
5. Reproduce the issue, make one focused change, and run the relevant checks.
   Open a PR using the template and include `Fixes #<github-issue-number>` and
   `Fixes DSUI-<linear-id>` in its description.

### Where to make a change

| Area | Directory |
| --- | --- |
| Product UI | `apps/web` |
| Server and runtime | `packages/server` |
| Adapter contracts and adapter UI | `packages/adapter-sdk` |
| Shared UI components | `packages/ui` |
| Official integrations | `packages/adapter-*` |
| Plugins and plugin contracts | `packages/plugin-*` |
| Website and documentation | `apps/site`, `apps/docs` |

For documentation-only changes, verify links, code examples, and commands.
Build the changed surface with `bun run --filter @northgraindata/dsui-docs build`
or `bun run --filter @northgraindata/dsui-site build`. Report what you checked;
you do not need to claim a full application test run for a prose-only change.

### Branch names

PR branches must use `<type>/dsui-<number>-<short-description>`, with lowercase
words separated by hyphens. Types are `feature`, `fix`, `docs`, `test`,
`refactor`, `chore`, and `ci`. Use the Linear ID of the current synced task,
not the original task that was marked as a duplicate. The branch-name CI check
also applies to contributions from forks. Maintainers may need to approve a
first-time contributor's workflow run.

## Choose and implement a change

For a bug, include expected and actual behavior, a minimal reproduction, and
relevant environment details without secrets. Reproduce it with a failing test
before fixing it. For a significant feature, explain the user need and discuss
scope with maintainers before investing in a broad implementation.

Keep each PR focused on one coherent purpose. Separate substantial refactoring
from behavior changes. Explain new dependencies and provide measurements for
performance claims. Public API, package-boundary, lifecycle, and security changes
need affected consumer tests and clear compatibility or migration guidance.

AI assistance is welcome under the same standards. Contributors remain accountable
for understanding their changes and accurately describing verification. Agents may
prepare changes; an accountable human maintainer reviews what merges.

## Pull requests and review

Use the PR template to explain the problem, resulting behavior, contract impact,
and checks actually run. Include screenshots for visible UI changes and interaction
evidence where behavior changes. Explicitly identify limitations or deferred work.

The maintainer team listed in [CODEOWNERS](.github/CODEOWNERS) reviews changes.
Maintainers distinguish required fixes from optional polish, resolve required
feedback, and check relevant CI before merging. Facts and engineering constraints
take precedence over personal preference. A focused improvement need not fix all
surrounding debt, but it must not silently worsen the architecture.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Report vulnerabilities through [SECURITY.md](SECURITY.md).
