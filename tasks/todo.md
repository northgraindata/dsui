# Shared engineering guidelines checklist

## 1. Canonical guidance

- [x] Coding and testing rules have rationale, examples, and enforcement.
- [x] Architecture identifies ownership, trust boundaries, lifecycle, and gaps.
- [x] Consequential changes have a lightweight decision-record process.

Verification: inspect guidance against SDK, host, browser, tests, and CI sources.

## 2. Contributor workflow

Depends on task 1.

- [x] CONTRIBUTING and AGENTS link to the same standards.
- [x] PR template captures intent, contract impact, and actual verification.
- [x] Local and CI formatter checks use the same working script.

Verification: execute formatter check and lint; check local Markdown links.

## 3. Handoff

Depends on task 2.

- [x] Relevant repository checks run and outcomes are reported accurately.
- [x] Final diff preserves unrelated changes.
- [x] Future enforcement work is distinguished from implemented safeguards.

## Verification outcomes

- Reproduced the missing `format:check` script before adding it. The command now
  invokes the same Biome check previously embedded in CI.
- `bun run format:check`: runs, fails on existing skill-file formatting (8 errors).
- `bun run lint`: fails on existing skill-file diagnostics (16 errors, 43 warnings,
  33 informational diagnostics). Unrelated skill files were left unchanged.
- Biome check of the changed `package.json`: passes.
- Local Markdown links: 34 checked across 9 files, all targets exist.
- `git diff --check`: passes. Reviewed canonical docs, entry points, template,
  script, and CI change against the inspected implementation.
- App tests, typechecks, builds, Docker, and remote CI were not run: this change
  edits guidance and exposes the existing formatter command, not runtime code or
  the generated documentation site. Remote merge settings remain unverified.
