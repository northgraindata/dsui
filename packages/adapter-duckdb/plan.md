# DuckDB adapter and shared UI platform

Defines the real DuckDB adapter and the shared SDK/renderer capabilities its UI
surface requires. Three
tracks; each platform change has a [decision record](../../docs/engineering/decisions/README.md).

## Tracks

- **Track A — DuckDB adapter** (no SDK changes; ~80% of DuckDB UI parity): catalog,
  table summary, preview, DDL, query workbench, settings, extensions, secrets, actions.
- **Track B — Shared SDK/renderer platform** (first consumer DuckDB, reused by every
  SQL adapter): B1 table power features, B2 column profile, B3 code editor, B4 export.
- **Track C — Decision records** for each B contract plus the adapter's dependency and
  security posture (0002–0009).

## Track A — DuckDB adapter

### Driver and runtime

Use the official `@duckdb/node-api` (DuckDB "Neo", ~1.5.x). Each adapter instance owns
one `DuckDBInstance` opened lazily in `createContext` and closed in `disposeContext`.
Files mirror the Snowflake reference: `context.ts` (config + catalog types + `DuckDbClient`
interface), `duckdb-client.ts` (real client), and `utils/` for value normalization
(JSON-safe mapping of BigInt/Decimal/BLOB/LIST/STRUCT/MAP under nesting/cell caps) and
SQL/identifier helpers. Tests use real in-memory DuckDB instances.

### Connection form (`connectionMethods`, one tab per method)

Declare each way to connect as a named method; the connection form
renders one tab per method. Each method has a flat Zod object schema.
Shipped today: `memory`, `file`, `remote` (S3-shaped). The full expansion
— one method per scheme family — is specified in [decision
0008](../../docs/engineering/decisions/0008-duckdb-connection-method-expansion.md)
and summarized below.

```ts
connectionMethods: {
  memory: { label: "In-memory", schema: z.object({}) },
  file: {
    label: "Local file",
    description: "A .duckdb file on the server.",
    schema: z.object({
      path: z.string().min(1),                    // file path
      readOnly: z.boolean().default(false),
    }),
  },
  remote: {
    label: "Remote",
    description: "Object storage or HTTP via httpfs.",
    schema: z.object({
      url: z.string().min(1),                     // s3://, gcs://, r2://, https://
      readOnly: z.boolean().default(false),
      s3AccessKeyId: z.string().optional(),       // password field
      s3SecretAccessKey: z.string().optional(),   // password field
      s3Region: z.string().optional(),
    }),
  },
}
```

### Connection-method expansion (per decision 0008)

| Phase | Methods | Notes |
|---|---|---|
| Shipped | `memory`, `file`, `remote` → group with `s3` | form shows Remote tab with an S3 sub-tab; siblings slot into the same strip (decision 0009) |
| P1 | `quack` + `gcs`, `r2`, `azure` join the `remote` group | Quack verified e2e on engine 1.5.5; no contract changes needed for new siblings |
| P2 | `https`, `motherduck` + `quack-serve`/`quack-stop` actions | lifts the MotherDuck deferral |
| P3 | `postgres`, `mysql`, `sqlite` scanners | `ATTACH … (TYPE …)` families |

One small per-method `dial()` (ensure extension, create scoped secret, query or
`ATTACH`) behind the existing `DuckDbClient` interface. SSRF policy per method:
private-range `quack:`/`https:` URLs rejected unless explicitly allowed; tokens
via scoped secrets, never inline in user SQL.

Shared engine settings (`threads`, `memoryLimit`, `tempDirectory`,
`defaultSchema`, extension flags) are common across methods; they can
live on each method or in a later shared section. The web Add-Service
form derives fields per method (text/password/number/boolean/select).
Secret fields are encrypted at rest and redacted from responses and
logs. "Test connection" opens an instance, runs `SELECT version()`,
and closes it.

### Resources (25)

| id | Input | Backing query | Refresh |
|---|---|---|---|
| `version` | — | `SELECT version()` | manual |
| `platform` | — | `pragma_platform()` | manual |
| `databases` | — | `duckdb_databases()` | 30s |
| `database-size` | `{ database? }` | `pragma_database_size()` | manual |
| `schemas` | `{ database }` | `duckdb_schemas()` | 60s |
| `tables` | `{ database?, schema? }` | `duckdb_tables()` | 30s |
| `table-details` | `{ database?, schema, table }` | `duckdb_tables()` summary | manual |
| `table-columns` | `{ database?, schema, table }` | `pragma_table_info()` / `duckdb_columns()` | manual |
| `table-preview` | `{ database?, schema, table, cursor?, limit? }` | `SELECT * LIMIT` (paginated) | manual |
| `table-constraints` | `{ database?, schema, table }` | `duckdb_constraints()` | manual |
| `table-indexes` | `{ database?, schema, table }` | `duckdb_indexes()` | manual |
| `table-ddl` | `{ database?, schema, table }` | `SELECT sql FROM duckdb_tables()` | manual |
| `column-profile` | `{ database?, schema, table }` | `SUMMARIZE` → `ColumnProfileRow[]` | manual |
| `views` | `{ database?, schema? }` | `duckdb_views()` | 30s |
| `view-details` | `{ database?, schema, view }` | `duckdb_views()` sql | manual |
| `sequences` | `{ database?, schema? }` | `duckdb_sequences()` | manual |
| `indexes` | `{ database?, schema? }` | `duckdb_indexes()` | manual |
| `macros` | `{ database?, schema? }` | `duckdb_macros()` | manual |
| `functions` | `{ search? }` | `duckdb_functions()` | manual |
| `types` | — | `duckdb_types()` | manual |
| `extensions` | — | `duckdb_extensions()` | 60s |
| `settings` | `{ search? }` | `duckdb_settings()` | 60s |
| `secrets` | — | `duckdb_secrets()` (redacted) | manual |
| `query-history` | `{ search?, status? }` | in-memory ring buffer | 10s |
| `result-profile` | `{ queryId }` | `SUMMARIZE` of completed result | manual |

### Actions (18 ids)

| id | Input | Result mode |
|---|---|---|
| `run-query` | `{ sql }` | json (cancellable, records history) |
| `run-file` | `{ sql }` (multi-statement) | json |
| `attach` | `{ source, alias, readOnly? }` | json |
| `detach` | `{ database }` | json |
| `create-schema` / `drop-schema` | `{ database?, schema }` | json |
| `create-table` / `drop-table` | `{ schema?, name, sql }` / `{ schema?, table }` | json |
| `create-view` / `drop-view` | `{ schema?, name, sql }` / `{ schema?, view }` | json |
| `create-index` / `drop-index` | `{ table, name, sql }` / `{ index }` | json |
| `create-sequence` / `drop-sequence` | `{ schema?, name }` / `{ schema?, sequence }` | json |
| `install-extension` / `load-extension` | `{ name }` | json |
| `create-secret` / `drop-secret` | `{ type, keyId, secret, region?, scope? }` / `{ name }` | json |
| `set-setting` / `reset-setting` | `{ name, value }` / `{ name }` | json |
| `checkpoint` | — | json |
| `import-data` | `{ table, source, format?, options? }` | json |
| `export-data` | `{ query, target, format }` | binary (download) |

### Pages (12)

| Route | Page |
|---|---|
| `/` | Overview: version/platform/size, databases, settings summary |
| `/query` | Query workbench: schema selector, CodeEditor, Run/Cancel, results + profile |
| `/databases` | Databases list (attach/detach) |
| `/databases/:database` | Database detail: size/read-only, schemas |
| `/databases/:database/schemas/:schema` | Schema detail: Tabs (Tables / Views / Sequences / Indexes / Macros) |
| `/databases/:database/schemas/:schema/tables/:table` | Table detail: Tabs (Preview / Columns / Constraints / Indexes / Profile / DDL / Summary) |
| `/databases/:database/schemas/:schema/views/:view` | View detail: definition |
| `/settings` | Settings list + set/reset |
| `/extensions` | Extensions list + install/load |
| `/secrets` | Secrets list (redacted) + create/drop |
| `/functions` | Tabs (Functions / Macros / Types) |
| `/query-history` | Recent runs, status, re-run |

### Components

Generic (SDK-owned, reused by every adapter):

- Built-in: `PageHeader`, `Table` (extended by B1), `Tabs`, `KeyValue`, `CodeEditor`
  (upgraded by B3), `Form`, `TextInput`, `Select`, `Button`.
- New: `ColumnProfile` (B2).

Custom (adapter-private) components: **none**. The DuckDB adapter composes entirely
from the generic set; adapters never supply React/HTML/JS.

## Track B — Shared platform

- **B1 Table power features**: client-side sort, filter, column visibility, and DOM
  virtualization in the renderer; server-side cursor pagination via a core
  `PaginatedResult<T>` and resource `{ cursor?, limit? }` input (0003).
- **B2 Column profile**: `ColumnProfile({ source })` node + `ColumnProfileRow` contract
  in core, backed by `SUMMARIZE` (0005).
- **B3 Code editor**: `@esm-dev/modern-monaco` editor + `@shikijs/monaco` highlighting;
  `language` is a shiki/monaco language id (0006).
- **B4 Export**: clipboard/CSV/JSON as renderer controls on result tables (data already
  in the browser); engine formats via binary action result mode (0004).

## Track C — Decision records

- `0002-duckdb-adapter` — driver, factory/mock pattern, security posture.
- `0003-cursor-pagination` — `PaginatedResult` contract.
- `0004-action-result-modes` — `json`/`binary`/`stream` action results.
- `0005-column-profile-component` — `ColumnProfile` node + contract.
- `0006-code-editor-highlighting` — modern-monaco + shiki.
- `0007-connection-methods` — `connectionMethods` replaces `connectionSchema`.
- `0008-duckdb-connection-method-expansion` — Quack + per-scheme remotes.
- `0009-connection-method-groups` — sub-tabs; groups are presentational only.

## Security posture (accepted risks)

- **No built-in auth**: DuckDB is single-user; rely on DSUI RBAC plus `readOnly` mode.
- **Filesystem access**: OS permissions only; the adapter can read/write any path the
  server OS user can. Documented risk, no allowlist.
- **Extensions fully open**: `INSTALL`/`LOAD` run native code in the server process.
  `autoInstall`/`autoLoad`/`allowUnsigned` default true. Documented risk.
- **SSRF**: user-supplied `ATTACH`/`url` validated against scheme/host allowlists and
  the server's SSRF guards before execution.
- **Secrets**: encrypted at rest; redacted from `duckdb_secrets()` output and logs.
- **Limits**: `memory_limit`/`threads`, row and cell caps, `interrupt()` on cancellation.

## Known SDK gaps (documented, not worked around)

Notebooks (multi-cell), autocomplete, result histograms/charts, confirmation modals,
download/stream primitives beyond binary actions, URL query params. Matches the
Snowflake `COVERAGE.md` gap list; notebooks is the top-priority follow-up.

## Phases and verification

1. Decision records (0002–0006).
2. Track B platform work: B1 renderer + cursor contract, B3 editor stack, B4 result
   modes, B2 profile component.
3. Track A adapter: context, utils, client, resources, actions, stores/pages,
   `COVERAGE.md`, docs page, and real in-memory adapter tests.
4. Verify: `bun run test` and `bun run typecheck` in `packages/adapter-duckdb`, then
   root `bun run check` and `bun run build`. Renderer changes get interaction tests.
