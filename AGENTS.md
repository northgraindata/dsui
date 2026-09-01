# Agent guide

This file applies to the entire repository. Read the nearest `AGENTS.md` before
changing a nested area if more scoped guidance is added later.

## Product context

dsui is a lightweight, local-first interface for working with a data stack
through one server-side adapter model and one compact UI. The current repository
is the Apache-2.0-licensed OSS product. The intended product family also includes
licensed Pro and Enterprise editions; see [PRODUCT.md](PRODUCT.md).

Treat lightweightness, server-side credential isolation, declarative adapter
views, and a genuinely useful OSS edition as product constraints. dsui is not a
data platform, orchestrator, observability suite, catalog, or universal clone of
every vendor console.

## Skills

Project skills live in `.agents/skills/<skill-name>/SKILL.md`. Load a matching
skill before acting and follow its required workflow. Use the smallest set that
covers the request.

- Significant feature or unclear requirement: `spec-driven-development`
- Planning and decomposition: `planning-and-task-breakdown`
- Multi-file implementation: `incremental-implementation`
- Logic or behavior changes: `test-driven-development`
- API, contract, or package-boundary work: `api-and-interface-design`
- UI work: `frontend-ui-engineering`; add `animate` only when motion is intended
- Refactoring without behavior changes: `code-simplification`
- Pre-merge or requested review: `code-review-and-quality`
- UI library selection: `pick-ui-library` only when explicitly requested
- Detailed UI polish: `emil-design-eng`

Do not invoke skills mechanically when their trigger does not match. If several
apply, sequence them rather than mixing contradictory workflows.

## Engineering priorities

Optimize in this order:

1. correctness and security
2. simplicity
3. readability
4. maintainability
5. delivery speed

Think before editing. For non-trivial work, inspect the relevant contracts and
callers, state the approach briefly, and identify consequential assumptions.
Prefer a small, coherent, well-shaped change over nominally completing a broad
task with duplication, speculative abstractions, or placeholder-quality code.
Never trade away architectural clarity merely to mark a task complete.

Beautiful code here means restrained code: explicit boundaries, strong names,
few concepts, minimal surface area, and no cleverness that makes the next change
harder. Abstract demonstrated patterns, not imagined future requirements.

## Stack and commands

The repository is a Bun/Turborepo TypeScript monorepo.

- Runtime and package manager: Bun
- Server: Hono, SQLite, Zod
- Product UI: React 19, Vite, TanStack Router, Tailwind
- Site and docs: Astro
- Formatting and linting: Biome
- Tests: Vitest or Bun Test; Playwright for browser flows
- Task orchestration: Turborepo

Use repository scripts rather than substituting npm, pnpm, ESLint, Prettier, or
another toolchain:

```sh
bun install
bun run lint
bun run typecheck
bun run test
bun run build
bun run check
```

Run the narrowest relevant package checks during iteration, then the appropriate
repository-wide checks before handoff. Do not edit `bun.lock` manually.

## Architecture

Dependencies point inward toward contracts:

- `packages/core` contains browser-safe domain and capability contracts.
- `packages/adapter-sdk` exposes the server-side adapter authoring API.
- `packages/adapter-*` own service-specific behavior and external integration.
- `packages/server` owns credentials, persistence, auth, configuration, HTTP,
  and adapter execution.
- `packages/ui` owns reusable design tokens and primitives.
- `apps/web` renders core-owned declarative views; it must not contain
  service-specific branches.
- `apps/site` and `apps/docs` are public static surfaces.

Core must not import adapters, server implementations, or UI frameworks. The
browser must never receive stored credentials or resolved secrets. Treat all
adapter responses and external-service data as untrusted at their boundary.

Adapters declare metadata, connection schemas, capabilities, validated views,
and operations. They do not ship browser JavaScript, React, HTML, CSS, SVG, or
iframes. Extend shared contracts additively where possible, then update server
serialization, web types/renderers, adapter conformance, and tests together.

## TypeScript and implementation style

- Keep strict types at public and package boundaries; avoid `any`, unjustified
  casts, and optional fields that conceal an invariant.
- Validate external input with Zod at system edges. Do not repeatedly validate
  trusted values between internal functions.
- Prefer discriminated unions and typed domain models over generic maps.
- Keep I/O at boundaries and pure transformation logic independently testable.
- Prefer composition and focused functions over inheritance or framework-heavy
  abstractions.
- Add dependencies only when existing packages or platform APIs cannot solve the
  problem cleanly enough to justify their runtime and maintenance cost.
- Preserve cancellation, bounded results, pagination, authorization classes,
  and consistent error semantics across adapter operations.

## Frontend

The application is a dense developer tool, not a marketing dashboard. Reuse
`packages/ui` primitives and the tokens in `DESIGN.md`. Keep components small,
domain logic outside presentation, state local unless it is genuinely shared,
and preserve keyboard operation, focus behavior, responsive layout, and reduced
motion.

Avoid oversized cards, decorative charts, gratuitous animation, one-off visual
systems, and service-specific UI conditionals. The public site may be more
editorial, but it still follows the restrained direction in `DESIGN.md`.

## Tests and completion

Test observable behavior rather than implementation details. Every bug fix needs
a regression test; every new behavior needs proportionate coverage. Prefer real
implementations, then fakes, then stubs, and mock only true external boundaries.

Before declaring work complete:

- inspect the final diff and preserve unrelated user or agent changes
- run relevant tests, type checks, lint, and builds in proportion to the change
- remove dead code, placeholders, and unnecessary complexity
- report exactly what changed, what was verified, and any remaining limitation

Do not claim success based only on code inspection when an executable check is
available. Do not alter tests merely to make an incorrect implementation pass.

