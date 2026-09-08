# Architecture decisions

Write a short decision record when a change affects public SDK or wire contracts,
package ownership, credential or authorization boundaries, lifecycle, persistence,
or a significant dependency. Routine fixes and private refactors do not need one.

Name records `NNNN-short-topic.md`. Start with the context and alternatives before
implementation. The accountable maintainer accepts the decision through review;
link its PR when available. Preserve accepted records and supersede them when the
decision changes. A proposal is not an implemented feature.

Use this structure, omitting sections that do not apply:

```markdown
# NNNN: Decision title

Status: Proposed | Accepted | Superseded by NNNN
Owner: accountable maintainer
Review: issue or PR

## Problem and constraints
Concrete use case, affected consumers, and invariants to preserve.

## Decision
Chosen design, ownership, and observable behavior.

## Alternatives
Plausible alternatives and why they were rejected, including doing less.

## Compatibility and rollout
Breaking effects, migration example, implementation slices, and rollback limits.

## Verification
Tests or measurements that establish the decision's important guarantees.

## Consequences
Costs, limitations, and any follow-up with an owner and acceptance criteria.
```

For example, the SDK-to-browser protocol needs a decision covering serializable
nodes, binding identity, and page lifetime. Extracting an existing private parser
without changing behavior generally does not.
