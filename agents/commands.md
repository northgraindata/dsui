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
