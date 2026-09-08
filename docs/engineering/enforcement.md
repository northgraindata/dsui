# Enforcement and follow-up

The [standards](standards.md) are review requirements. This page distinguishes
existing automation from work still needed; documentation alone does not enforce
architecture or prove OSS readiness.

## Current safeguards

- Root scripts run Biome, package typechecks, tests, and builds. `check` combines
  lint, typecheck, and tests; build remains separate.
- [CI](../../.github/workflows/ci.yml) runs formatting, lint, typechecks, tests,
  adapter tests, builds, Docker and Compose checks, dependency audit, and bundle
  size reporting. The formatter uses the same script as local contributors.
- SDK tests include public runtime export names and TypeScript usage assertions.
  Adapter tests exercise composition, execution, invalidation, and isolation.
- [CODEOWNERS](../../.github/CODEOWNERS) routes changes to the maintainer team.
  The [PR template](../../.github/pull_request_template.md) asks for intent,
  contract impact, and verification evidence.

The adapter CI job currently discovers `packages/adapter-*/test/*.test.ts`.
It can miss an adapter with no matching test file; it is not a shared mandatory
conformance harness. Public export names do not capture declaration signatures.
Bundle reporting has no agreed failure threshold.

## Ordered follow-up

Each item needs its own scoped change and accountable maintainer before work begins.

| Work | Acceptance evidence |
| --- | --- |
| Package boundary check | Reject forbidden imports, cross-package implementation imports, and browser dependencies on server/runtime packages; include failing fixtures and cover package aliases and relative imports |
| SDK public declaration report | Reviewable signatures from supported entry points; CI detects unacknowledged changes; compatibility and migration documented |
| Explicit adapter conformance discovery | Every adapter and template declares and runs the shared suite; missing registration or tests fail; both host paths are exercised where applicable |
| Executable documentation examples | Compile/run complete quickstart and template examples against the current SDK; distinguish illustrative snippets from runnable examples |
| Adapter-to-browser protocol | Accepted decision plus one validated, authorized, bounded end-to-end path with real rendering and lifecycle tests |
| SDK and screen cleanup | Focused changes reduce responsibilities and undocumented assumptions while preserving tested behavior; avoid file splitting alone |

## Repository settings

CODEOWNERS and workflow files do not establish merge protection. A repository
administrator must verify required CI checks, required owner approval, and stale
approval handling in GitHub rulesets or branch protection. Record the actual
settings when verified; this documentation rollout does not attest to or change
remote settings.

## Research basis

These are sources for the chosen practices, not additional rules contributors
must follow. DSUI's checked-in standards remain authoritative.

- [Rust's human-first LLM policy](https://blog.rust-lang.org/inside-rust/2026/08/05/rust-langrust-is-adopting-an-llm-policy/): human-readable policy and review accountability.
- [Kubernetes PR process](https://www.kubernetes.dev/docs/guide/pull-requests/): focused changes and reviewer attention.
- [Backstage contribution guide](https://github.com/backstage/community-plugins/blob/main/CONTRIBUTING.md): reviewable public API reports and release discipline.
- [SQLite testing](https://www.sqlite.org/testing.html): regression and failure-mode testing.
- [Google's review standard](https://google.github.io/eng-practices/review/reviewer/standard.html): improving code health and separating required changes from preference.
- [Astral AI policy](https://github.com/astral-sh/.github/blob/main/AI_POLICY.md) and [Vercel AI SDK contributing](https://github.com/vercel/ai/blob/main/CONTRIBUTING.md): different automation policies; DSUI allows implementation assistance with accountable human merge review.
