# Agent guide

This file applies repository-wide. Follow the relevant guidance before making
changes, preserve unrelated work, and keep each change focused and reviewable.

## Start here

- [Contributing](CONTRIBUTING.md): setup, repository checks, and contribution workflow.
- [Agent guidance index](agents/README.md): reusable engineering rules and commands.
- Read the nearest `AGENTS.md` before changing a nested area if one exists.

## Working agreements

- Inspect relevant callers, contracts, and tests before changing behavior.
- Prefer the smallest clear implementation that satisfies the requirement.
- Verify observable behavior with focused checks; report commands and results honestly.
- Do not create `*.test.ts` files at this point.
- Preserve type safety. Avoid unsafe casts and silent fallbacks.
- Keep comments focused on intent or non-obvious constraints.
- Use Conventional Commits for new commits: `type(scope): short description`
  (for example, `feat(ai-agent): add batch resource reads`). Keep each commit
  focused and use `feat`, `fix`, `docs`, `refactor`, `test`, or `chore` as appropriate.
- A human maintainer remains accountable for reviewing and merging changes.
