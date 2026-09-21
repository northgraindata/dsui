# Engineering Standards

These standards apply to product code, adapters, SDK changes, and documentation.

## Keep Changes Focused

- Inspect contracts and callers before changing behavior.
- Prefer the smallest implementation that satisfies the requirement.
- Separate refactoring from behavior changes.
- Preserve unrelated work in the tree.

## Test Observable Behavior

- Reproduce bugs with a focused failing test when practical.
- Run the affected package checks while iterating.
- Run the relevant root checks before handoff.
- Do not weaken tests, add silent fallbacks, or bypass validation.

## Respect Boundaries

- Resources read external data.
- Actions perform commands and mutations.
- Stores own adapter and page state; persistent state must use stores.
- Context owns runtime dependencies and lifecycle.
- UI pages compose SDK components rather than embedding application-specific
  browser code.

Public API, package-boundary, lifecycle, and security changes require a decision
record and tests for affected consumers.

## Report Verification Honestly

Record the commands that were actually run, their results, and any known
limitations. A local check does not replace CI checks for Docker, delivery
artifacts, dependencies, or bundle size.
