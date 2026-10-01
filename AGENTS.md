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
- Preserve type safety. Avoid unsafe casts and silent fallbacks.
- Keep comments focused on intent or non-obvious constraints.
- A human maintainer remains accountable for reviewing and merging changes.
