# 0017: Entity presentation contract (EntityCatalog, EntityDetail)

Status: Proposed
Owner: accountable maintainer
Review: PR

## Problem and constraints

Extension and database listings need searchable catalogs and detail views
beyond what `Table`/`CardList` express (filters, badges, facts, links,
confirmations, install actions). Adapters must not ship markup.

## Decision

Add generic `EntityCatalog`/`EntityDetail` SDK nodes with core wire types,
serialization, and renderer views. DuckDB is the first consumer
(extension catalog and detail); any adapter can reuse them. Server
sessions (0016) stay independent.

## Alternatives

- Stretching `CardList` with filters/actions: rejected, it would turn a
  simple card grid into a second framework.
- Adapter-private components: rejected by architecture (no adapter markup).

## Compatibility and rollout

Additive contract. Rollback: delete the nodes; DuckDB extension pages
fall back to tables.

## Verification

SDK contract tests, adapter extension tests, renderer typecheck.

## Consequences

Filter and badge vocabularies are string-based; formalizing them is a
follow-up if a second adapter needs stricter contracts.
