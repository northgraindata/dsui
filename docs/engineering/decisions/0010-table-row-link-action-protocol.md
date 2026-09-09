# 0010: Table row-link and row-action protocol

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

Adapter tables cannot navigate or act per row across the server/browser
boundary. `Table`'s `onRowClick` and `actions` are closures, and the
serializer rightly rejects them — so every drill-down page and every row
button in Snowflake and DuckDB fails end-to-end with "Table callbacks cannot
be serialized". This is the first slice of the serializable-views protocol
the architecture requires before expanding it: one complete
adapter-to-browser path (browse → drill down → act) with no executable code
crossing the boundary. The web router has no catch-all for adapter deep
paths, and the renderer has no navigation capability.

## Decision

Replace the callback props with declarative specs that serialize losslessly:

```ts
Table({
  source: tables({ database, schema }),
  rowLink: { path: "/databases/:database/schemas/:schema/tables/:table", params: { database: "database", schema: "schema", table: "name" } },
  rowActions: [
    { label: "Drop", variant: "danger", action: dropTable, input: { database: "database", schema: "schema", table: "name" } },
    { label: "Resume", action: resumeWarehouse, input: { warehouse: "name" }, when: { field: "status", equals: "SUSPENDED" } },
  ],
});
```

- `rowLink.params` maps URL param name → row field name. The renderer
  URL-encodes substituted values.
- `rowActions[].action` accepts an action definition or a bare id; the wire
  carries `{ actionId, input }` with input fields mapped from the row the
  same way. Substitution happens renderer-side; the server validates the
  concrete input through the unchanged execution path.
- `when` gates a button on row data: all present clauses must match
  (`===` for `equals`, `!==` for `notEquals`).
- `onRowClick`/`actions` callbacks are removed (Snowflake and DuckDB migrate
  together); the serializer no longer has callback branches to reject.
- `RendererClient` gains `navigate(path)`; the web implements it over a new
  splat route (`/services/$serviceId/$`) that maps the remainder onto the
  adapter page path. `DataTable` gains row-click and action-column rendering;
  the SDK `Button` variants map primary→default, secondary→secondary,
  danger→danger.

Snowflake's schema-scoped lists return bare names (matching what its real
client already returns from `SHOW`); the `.split(".").pop()` guards written
for the fake's qualified names go away with the migration.

## Alternatives

- **Keep callbacks, add declarative alongside**: two APIs for one concept with
  one permanently throwing in the serializer; rejected.
- **Expression mini-language for links/inputs**: arbitrary transforms belong
  in resources, not in presentation specs; rejected.
- **Server-side link pre-rendering**: links depend on row data the server
  would have to execute to see; substitution stays renderer-side where rows
  already live.

## Compatibility and rollout

Breaking for adapter authors: `onRowClick`/`actions` are removed; the
compiler guides migration site by site. The wire only gains optional fields.
Snowflake, DuckDB, and their tests migrate in this change. Legacy web routes
are untouched; the splat only adds reachability for deep adapter paths.

## Verification

Core type tests for the new table props; SDK node/serializer tests for
specs, `when` gating shapes, and path validation; renderer tests for
substitution, encoding, gating, and post-action refresh; web tests for the
splat mapping; adapter tests asserting serialized pages carry the specs.

## Consequences

Per-row conditions beyond field equality, link targets outside adapter pages,
and multi-row selection remain out of scope — each needs its own decision.
Store-bound inputs and the code editor are still unserializable (separate
track); pages using them stay server-renderable only where no boundary is
crossed.
