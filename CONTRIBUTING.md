# Contributing to dsui

Focused issues, reproductions, documentation fixes, and code contributions are
welcome. You do not need an AI tool or agent skills to contribute.

## Read the shared guidance

- [Engineering standards](docs/engineering/standards.md): coding, testing,
  compatibility, review, and human/agent accountability.
- [Architecture](docs/engineering/architecture.md): where code belongs and the
  boundaries new changes must preserve.
- [DESIGN.md](DESIGN.md): UI direction and tokens.
- [Adapter SDK docs](packages/adapter-sdk/docs/README.md): authoring and runtime
  semantics; start new adapters from [the template](templates/adapter/README.md).

These documents are canonical for humans and agents. [AGENTS.md](AGENTS.md)
adds agent navigation and workflow; contributors do not need to read skills.

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

`bun run check` combines lint, typecheck, and tests. Lint includes Biome formatting
checks; `format:check` runs formatting alone. Build remains separate. Use
`bun run format` to apply formatting, then inspect the diff for unrelated edits.

During iteration, use the affected package's scripts. For example:

```sh
bun run --filter @northgraindata/dsui-adapter-sdk test
bun run --filter @northgraindata/dsui-adapter-sdk typecheck
bun run --filter @northgraindata/dsui-adapter-snowflake test
bun run --filter @northgraindata/dsui-adapter-snowflake typecheck
```

SDK or adapter changes must run SDK tests and affected adapter tests and typechecks.
Host or protocol changes also need server integration checks. Root `test` runs
workspace test scripts; CI additionally runs adapter test files in a separate job.
There is not yet a shared mandatory conformance harness; see
[current enforcement and follow-up](docs/engineering/enforcement.md).

Run the root checks for code changes before handoff. For documentation-only edits,
check formatting, local links, and any changed commands; build the relevant docs
surface when changing it. Explain any omitted or failing check. CI also checks
delivery artifacts, Docker, Compose, dependencies, and bundle sizes; a local test
run is not a claim that those checks passed.

## Choose and implement a change

For a bug, include expected and actual behavior, a minimal reproduction, and
relevant environment details without secrets. Reproduce it with a failing test
before fixing it. For a significant feature, explain the user need and discuss
scope with maintainers before investing in a broad implementation.

Keep each PR focused on one coherent purpose. Separate substantial refactoring
from behavior changes. Explain new dependencies and provide measurements for
performance claims. Public API, package-boundary, lifecycle, and security changes
need a short [decision record](docs/engineering/decisions/README.md), plus affected
consumer tests and documentation. Experimental APIs still need migration guidance
when they break.

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
