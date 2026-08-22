# Contributing to dsui

Thank you for helping make data-stack development simpler.

## Setup

Install Bun 1.3 or newer, then run:

```bash
bun install --frozen-lockfile
bun run dev
```

Before submitting a pull request:

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Use `bun run test:e2e` for browser-facing changes. Adapter changes must run the shared contract suite.

## Principles

- Ask whether each significant dependency or feature is more useful than its weight.
- Keep service-specific code in adapters.
- Keep infrastructure credentials and adapter execution server-side.
- Prefer focused changes with tests over broad rewrites.
- Do not invent performance claims; include reproducible measurements.
- Update public documentation when configuration or contracts change.

## Pull requests

Explain the user-visible behavior, validation performed, dependency/resource impact, and security implications. Include screenshots for visible UI changes. Generated artwork must include its generation prompt and reference role in `assets/generated/README.md`.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
