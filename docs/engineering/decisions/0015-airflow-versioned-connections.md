# 0015: Explicit Airflow 2 and 3 connection methods

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The Airflow adapter currently targets only Airflow 3's stable `/api/v2` API and
requires a bearer JWT. Airflow 2.10 exposes its stable API under `/api/v1`,
commonly uses Basic authentication, returns different fields for several
resources, and calls assets datasets. Existing Airflow 3 service configurations
and adapter domain contracts must remain valid.

## Decision

Keep the existing `airflow` connection method for Airflow 3 and add an
`airflow-2` method with a deployment URL, username, and password. The selected
method determines the API root and authorization header without network probing.
One client owns transport limits, cancellation, sanitized errors, and explicit
version-specific Zod schemas. It normalizes both provider contracts into the
existing DAG, run, task, log, and asset domain models.

Airflow 2 datasets are presented through the existing asset resources and pages.
Dataset detail is resolved from the same bounded dataset collection because the
Airflow 2 detail endpoint is keyed by URI while the existing DSUI route is keyed
by numeric id.

## Alternatives

- Automatically probe `/api/v2` and then `/api/v1`: rejected because it sends
  credentials to an endpoint the user did not select and makes failures depend
  on proxy-specific status behavior.
- Replace the existing method with one form containing every credential field:
  rejected because invalid credential combinations become representable and the
  existing Airflow 3 configuration contract would break.
- Ship a second adapter package: rejected because both APIs represent one
  provider and share the same DSUI capabilities and domain models.

## Compatibility and rollout

Existing Airflow 3 configurations using `method: airflow`, `baseUrl`, and `token`
continue unchanged. New Airflow 2 configurations use `method: airflow-2`,
`baseUrl`, `username`, and `password`. Earlier Airflow 2 versions are not claimed
because mapped-task and dataset capabilities differ across the major line.

## Verification

Transport tests cover both API roots and authorization schemes. Airflow 2.10
fixtures cover version-specific DAG/task/run/log/dataset mapping and mutations.
Adapter wiring tests cover both connection schemas and preserve Airflow 3 calls.

## Consequences

The adapter maintains two provider response contracts at one I/O boundary.
Airflow 2 dataset detail performs a bounded collection read, and dataset display
names fall back to their URIs because Airflow 2 has no asset name/group fields.
