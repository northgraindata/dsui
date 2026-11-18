# Commands

Use the toolchain and scripts declared by the repository. For this repository,
use the pinned Bun version and run commands from the root unless a package check
is more appropriate.

## Setup and development

```sh
bun install --frozen-lockfile
bun run dev
```

## Verification

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

For iteration, inspect the affected package's `package.json` and run its focused
test, typecheck, or build script. Run the relevant root checks before handoff.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for the canonical check requirements.

## CI gates

Selected layer pipelines run the repository lint before typecheck, tests, build,
docs or Docker jobs. The remaining validation matrix cancels sibling jobs on a
failure. The final status always runs and rejects failed, cancelled or
unexpectedly skipped selected jobs; unaffected layers may be skipped.

Run the gate regression tests with:

```sh
bun test scripts/ci-status.test.ts scripts/ci-scope.test.ts
```

Each layer reports a distinct final check: `adapter-sdk / status`,
`plugin-sdk / status` and `product / status` (GitHub may prefix these with the
calling job name). Require all three observed check names in branch protection
before relying on CI to block merges. Workflow changes alone do not configure
repository protection; administrator bypass policy is a separate maintainer
decision. Do not merge failing or pending checks as part of normal delivery.
