# Agent guide

This file applies to the entire repository. Read the nearest `AGENTS.md` before
changing a nested area if more scoped guidance is added later.

## Start here

Humans and agents follow the same canonical rules:

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, commands, change workflow, and review.
- [Engineering standards](docs/engineering/standards.md): coding, testing,
  compatibility, and accountability.
- [Architecture](docs/engineering/architecture.md): product constraints, package
  ownership, trust boundaries, lifecycle, and known gaps.
- [DESIGN.md](DESIGN.md): UI direction and tokens, when changing interfaces.
- [SDK docs](packages/adapter-sdk/docs/README.md): adapter authoring semantics,
  when changing adapters or the SDK.

Read the relevant documents before editing. Do not duplicate their policy in
agent-only files. Existing code may violate the intended architecture; do not
copy a weak pattern just for consistency. Changes to contracts or ownership need
a [decision record](docs/engineering/decisions/README.md).

## Execution

- Inspect contracts and callers before non-trivial edits; state the approach and
  consequential assumptions briefly. Keep changes focused and reviewable.
- Preserve unrelated user and agent work. Inspect the final diff before handoff.
- Use Bun and repository scripts; do not substitute another toolchain or hand-edit
  `bun.lock`. Run focused package checks while iterating, then relevant root checks.
- `bun run check` runs lint, typechecks, and tests. `bun run build` is separate.
  See CONTRIBUTING for the complete command list and adapter checks.
- Verify observable behavior. Do not weaken tests, add casts or silent fallbacks,
  or bypass checks to make an incorrect implementation pass.
- Report what changed, commands actually run, their outcomes, and remaining
  limitations. Distinguish observed results from assumptions and unrun checks.
- Agents may implement and review; an accountable human maintainer reviews what
  merges. Do not treat an agent's approval as proof of correctness.

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

Skills provide task workflows, not a second engineering policy. Repository
standards and commands take precedence over generic skill examples. Resolve
consequential conflicts explicitly.
