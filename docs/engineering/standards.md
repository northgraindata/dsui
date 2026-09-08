# Engineering standards

These standards apply equally to human and agent contributions. Read
[CONTRIBUTING](../../CONTRIBUTING.md) for the workflow and
[architecture](architecture.md) for package ownership. Product interfaces follow
[DESIGN.md](../../DESIGN.md); adapter semantics live in the
[SDK documentation](../../packages/adapter-sdk/docs/README.md).

Optimize for correctness and security, then simplicity, readability,
maintainability, and delivery speed. A change should improve the health of the
system it touches. Existing code is evidence to inspect, not permission to repeat
a weak pattern. Do not require an unrelated rewrite to land a focused improvement.

## Scope and design

Use one coherent purpose per change. Separate substantial preparatory refactoring
from new behavior; keep each increment functional. Explain the problem, affected
callers, and consequential assumptions before implementing non-trivial work.
Record changes to package ownership, public contracts, trust boundaries, or
lifecycle in a [decision record](decisions/README.md).

Prefer explicit, focused functions and composition. Introduce an abstraction when
it removes demonstrated duplication or makes an invariant easier to enforce.
Do not introduce registries, strategies, base classes, or configuration layers
for hypothetical extensions. A public extension point costs more to maintain than
a private helper.

For example, two resource handlers can call a shared parser without introducing
a generic pipeline framework. Splitting a large screen into files helps only if
data transformation, orchestration, and presentation acquire clear ownership.
File size and diff size are review signals, not quotas to satisfy through wrappers.

Enforcement: reviewers require an explanation for new concepts and dependencies,
and block structural regressions. Biome handles mechanical style; it cannot judge
whether an abstraction earns its complexity.

## Types and boundaries

Keep public and package boundaries strictly typed. Prefer named domain models
and discriminated unions over generic maps and combinations of optional fields.
Use `unknown` for genuinely untrusted values, then validate at the owning system
edge with Zod. Do not repeatedly parse trusted values inside one boundary.

For example, model a result as success with data or failure with an error, rather
than `{ data?: T; error?: string }`, which also admits neither or both. A parsed
adapter result must not become valid merely because the browser writes
`response.data as unknown[][]`. Define and validate the shared result contract.

Avoid `any`, non-null assertions, and casts that hide missing invariants. A narrow
cast at a generic runtime registry may be justified when the type system cannot
express the relationship: keep it at that boundary, explain what establishes the
relationship, and test mismatches. Do not spread double casts across consumers.

Keep I/O at boundaries and transformations independently testable. Catch failures
where recovery or translation is meaningful. Preserve useful internal causes;
translate errors into the documented public contract without exposing credentials
or raw sensitive provider responses. Do not turn malformed data into empty success
through a fallback. Defaults are appropriate only when absence is valid behavior.

Enforcement: typecheck, negative type assertions, malformed-input tests, and
boundary review. Passing TypeScript does not establish runtime validity.

## SDK and compatibility

Treat every public export as a supported surface with a concrete consumer.
Document input, output, errors, side effects, and lifecycle where applicable.
Prefer private implementation details until an external author needs them.
Installation and integrity policy must not grow incidentally through the adapter
authoring API; see the current boundary gap in [architecture](architecture.md).

For a contract change, identify SDK authors, host serialization, core types,
browser rendering, reference adapters, templates, and docs that consume it.
Update affected consumers and tests together. Test valid usage and invalid usage,
not just export names. Adding an optional field can still break consumers if it
changes defaults, interpretation, or serialized output.

The SDK is experimental before 1.0, but breaking changes still require an explicit
compatibility decision, release note, and migration example. Do not imply arbitrary
SDK versions interoperate: the current loader checks the SDK version exactly.
Do not remove existing exports silently during a cleanup.

Enforcement: SDK type tests and public-export tests run today. Maintainers review
signature and behavioral changes explicitly. Generated declaration reports and a
published compatibility matrix remain follow-up work in
[enforcement](enforcement.md).

## Lifecycle, security, and resource limits

Every client, timer, subscription, process, and store needs an owner and a cleanup
point. Definitions must not hold mutable per-connection state. A second adapter
instance must not observe the first instance's credentials, caches, or selections.

Preserve cancellation and cleanup on success, failure, timeout, and disposal.
Do not promise cancellation if only the caller stops waiting while work continues.
State which layer aborts work and which owns the time budget. Reads belong to
`inspect`; side effects belong to `execute`. A resource must not mutate provider
state to bypass authorization.

Bound external data and work: query results, pagination, polling, retries, host
messages, and logs. Explain limits at the interface and test boundary values.
Do not add retries to mutations unless retry safety is established. Keep secrets
server-side and out of browser payloads, logs, fixtures, and committed config.
Subprocess execution and package integrity checks do not make malicious adapter
code safe; see [trust boundaries](architecture.md#trust-boundaries).

Enforcement: relevant authorization, isolation, cancellation, cleanup, malformed
output, and limit tests are required for changes to these paths. Review the full
execution path rather than assuming the SDK alone enforces the guarantee.

## Tests that establish behavior

Reproduce a bug with a failing test before fixing it. New behavior needs coverage
proportionate to its risks. Pure prose, formatting, and static configuration edits
need appropriate executable checks, not tests that restate the edited text.

Prefer real implementations, then stateful fakes, then stubs. Mock true external
boundaries rather than internal functions. A fake provider client should implement
the production interface, maintain independent state, and reflect mutations in
subsequent reads. Direct SDK tests complement host and HTTP integration tests;
they do not prove serialization, authorization, or browser behavior.

Choose the layers affected by the change:

| Change | Evidence to provide |
| --- | --- |
| Parser or transformation | Valid, invalid, empty, and boundary inputs |
| Public SDK API | Runtime semantics and accepted/rejected TypeScript usage |
| Adapter behavior | Real SDK with a fake client; validation, isolation, lifecycle |
| Execution or transport | Relevant in-process and subprocess behavior, malformed output, limits |
| Credentials or auth | Allowed/denied requests and secret non-disclosure |
| Persistence | Real SQLite migrations and existing-data behavior |
| UI interaction | Observable interaction, keyboard/focus behavior, loading/error/empty states |

Synchronize asynchronous tests on observable completion or controlled clocks.
Do not use a fixed sleep as proof that work finished. Use a bounded deadline to
fail a stalled test, and release resources in `finally` or test cleanup even when
assertions fail. For timing behavior, test the intended interval and cancellation
with controlled time where supported; keep real-clock integration checks bounded.

Assertions should catch a plausible regression. Avoid broad snapshots that hide
the behavior under review. Never change expected values, disable a test, or weaken
a check solely to make incorrect code pass. Report pre-existing failures separately.

Enforcement: package tests, typecheck, and relevant integration/browser checks.
Coverage percentages and test counts are supporting information, not acceptance
criteria by themselves.

## Frontend and dependencies

Keep domain transformations outside presentation and state local unless shared
ownership is demonstrated. Reuse `packages/ui` primitives and existing design
tokens. Preserve keyboard operation, focus, responsiveness, and reduced motion.
Adapters supply declarative intent; the browser owns rendering. Vendor-specific
operation names and positional result conventions must not leak into generic UI.

Use the existing Bun, TypeScript, Biome, and test toolchain. Add a dependency only
when existing packages or platform APIs cannot solve the problem cleanly. Explain
its purpose, license compatibility, runtime/bundle cost, and maintenance cost.
Performance claims require reproducible measurements. Keep upgrades focused,
review relevant changelogs and lockfile changes, and never edit `bun.lock` manually.

Enforcement: UI review, relevant interaction checks, builds, dependency review,
and CI audit. Bundle reporting currently records sizes without an agreed threshold.

## Review and accountability

A contributor must understand the submitted change and be able to explain its
behavior and tradeoffs. Agents may implement and test changes; an accountable
human maintainer must review what merges. Agent review supplements human review.
Contributions generated by tools meet exactly the same standards as other work.

Review in this order: correctness and security, architecture and simplicity,
observable behavior and tests, then readability and polish. Classify feedback as
blocking, required, optional, or informational. Explain the violated invariant
and a concrete remedy. Evidence outranks preference; equivalent sound approaches
do not need to match the reviewer's personal taste.

Approve improvements that satisfy the requirements even if unrelated imperfections
remain. Do not accept new architectural debt with only a promise to clean it up.
An exceptional deferral needs a recorded reason, accountable owner, and follow-up
acceptance criteria. Do not manufacture emergency exceptions for delivery speed.

Before handoff, inspect the full diff, preserve unrelated work, remove introduced
dead code and placeholders, and report actual commands and outcomes. Explain
unrun checks and remaining limitations. Do not claim a build or test passed from
inspection or another agent's confidence. Maintainers verify the evidence and
resolve required feedback before merge.
