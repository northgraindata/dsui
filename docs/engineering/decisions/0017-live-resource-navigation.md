# 0017: Live resources and post-action navigation

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

An Airflow trigger returns the identity of a new DAG run, but declarative action
buttons cannot navigate using that result. Resource refresh policies also stop
at the SDK binding and are absent from the browser-safe page document, so a
graph loaded through HTTP is a one-time snapshot. The browser must remain
provider-neutral, timers need explicit cleanup, and a successful trigger must
not be presented as successful completion of the run.

## Decision

Extend existing page fields additively:

- `ResourceReference.refresh` carries the resource binding's serializable
  refresh descriptor. Renderers schedule the next read only after the previous
  read settles and stop scheduling when the view unmounts.
- Buttons and table row actions may declare `successLink`, using the existing
  absolute-path plus parameter-map shape. Parameters resolve from successful
  action output, are URL encoded, and navigation occurs only when every value is
  present.
- Dependency graphs may declare `stateField`. The renderer shows the raw state
  label and maps common workflow-state families onto existing semantic tokens.
  Color is supplementary, not the only state signal.

Airflow exposes a derived resource that joins bounded DAG topology and task
instance reads. This keeps Airflow mapping semantics server-side while the
generic renderer receives ordinary graph rows.

## Alternatives

- Hard-code `trigger-dag` navigation and Airflow state names in the web app:
  rejected because provider behavior cannot live in the generic browser.
- Put a second polling interval directly on `DependencyGraph`: rejected because
  freshness already belongs to resources and two declarations could conflict.
- Add WebSockets or SSE: rejected for this slice because Airflow's stable API is
  request-based and bounded polling already exists in the SDK contract.

## Compatibility and rollout

All wire and SDK fields are optional. Existing pages remain snapshots unless
their resource declares polling, and existing actions remain in place after
success unless they declare a destination. The Airflow run page adopts the new
fields immediately; rollback removes the optional declarations and restores
snapshot behavior without changing stored data.

## Verification

SDK serialization tests cover refresh, success-link, and state-field output.
Renderer tests cover graph-state parsing and safe action-result link resolution.
Airflow adapter tests cover joined topology, state rows, serialized page shape,
and trigger destinations. Package typechecks, root checks, and the build cover
all consumers.

## Consequences

Polling adds repeated bounded HTTP requests only while a view is mounted. A
failed refresh leaves the last good graph visible with an error indication.
Mapped task instances appear as individual nodes and may create multiple edges;
this is accurate but can make large mapped runs visually dense.
