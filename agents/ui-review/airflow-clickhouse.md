# Airflow and ClickHouse: first pass

These pages were changed without a page-by-page review, so none of them is accepted.
The [page ledger](pages.md) records what changed on each.

## Questions for the maintainer

- Should "Retry task" ask for confirmation?
  It clears a failed task instance, so Airflow runs it again, but R4 does not list retry.
- `managementPage` in ClickHouse (`/manage`) is defined but never registered, so nobody can open it.
  Should it be registered or deleted?
- How should SQL that changes data be confirmed?
  This is already an open decision in the conventions.

## Still not following the conventions

- R11 and R13: the Airflow dependency graph draws the operator as a single letter without a tooltip.
  It needs the icon registry, which does not exist yet.
- R14: Airflow lists use badges for types and groups, such as schedule, run type, operator and connection type.
  Replacing them also needs the icon registry.
- R15: states do not share one vocabulary yet.
- R16: failed reads have no common retry, and there is no `retryPolicy`.
- R17: a failed background refresh does not mark data as stale.
- R19: Airflow formats some times in its resources, so they ignore the user's settings.
  Durations in detail panels have no unit.
- A list does not refresh at once after a change made in a modal.
  Airflow connections, variables and pools and ClickHouse databases poll every 30 seconds, and a row action reloads its list.
  A header action in a modal relies on the action's invalidation or the next poll.
  The ClickHouse explorer tree does not refresh until the page is reopened.
- A toast raised while the native connection dialog is open is drawn under it.

## Convention changes

The proposals from this pass, for R18, R19 and R25, are now in the conventions.
Rules R27 to R45 were added after the Airflow redesign, so the pages above need another look against them.
