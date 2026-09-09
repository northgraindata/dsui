# 0007: Connection methods replace the flat connection schema

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The connection form is derived from a single flat Zod `connectionSchema`, so every
top-level secret/path field is shown at once. For adapters with several ways to
connect (DuckDB in-memory vs local file vs remote), users must guess which fields
apply. The form cannot render per-mode tabs. The SDK already defines the adapter
boundary; changing it touches core types, server serialization, and the web form.

## Decision

Replace the author-facing `connectionSchema` with `connectionMethods`: a record of
named methods, each with a label, optional description, and its own flat Zod object
schema. `defineAdapter` exposes them as `connectionMethods` and synthesizes the
runtime validation schema from them — the method's own schema directly when there
is exactly one method, otherwise a `z.discriminatedUnion("method", …)` over the
methods. The connection form renders one tab per method, or the fields directly for
a single method. Fields still derive from the per-method JSON Schema (text, password,
number, boolean, select). Secrets remain encrypted at rest and redacted.

`connectionSchema` on the definition becomes a derived, read-only value used by the
existing `parse` call sites; authors no longer pass it into `defineAdapter`.

## Alternatives

- **Keep `connectionSchema` plus add tabs**: retains two author-facing options for
  one concept; rejected to avoid redundancy.
- **A `mode` enum discriminator inside one flat schema**: still lists every field in
  one form; cannot hide mode-specific fields.
- **Procedural field definitions**: moves state out of declarative Zod into code;
  matches nothing else in the SDK.

## Compatibility and rollout

Breaking for adapter authors: `connectionSchema: X` becomes
`connectionMethods: { default: { label: …, schema: X } }`. Single-method adapters
validate their fields unchanged (no `method` tag). Multi-method adapters obtain a
`method` discriminator in the parsed config. Snowflake, DuckDB, and the template are
migrated; the web form and server payloads carry `connectionMethods`.

## Verification

Sdk `defineAdapter` tests cover normalization, single/multi-method union synthesis,
and validation errors. Server loader tests cover method serialization. Web tests
cover tab parsing from `connectionMethods`. Existing Snowflake/DuckDB routes and the
web Add-Service flow keep passing.

## Consequences

Authors type their context `config` explicitly for multi-method adapters (as they
already do with a config alias). The `method` tag is internal plumbing, surfaced to
authors only through the union's parsed output.
