# ClickHouse adapter

Browse ClickHouse databases, run bounded SQL and inspect active queries using the
public DSUI Adapter SDK.

Package: `@northgraindata/dsui-adapter-clickhouse` (private workspace package).

## Configure

Run DSUI from the repository root for this local source path, or use an absolute path.

```yaml
adapters:
  clickhouse:
    source: local
    path: ./packages/adapter-clickhouse

services:
  - id: warehouse
    adapter: clickhouse
    name: ClickHouse
    connection:
      method: structured
      host: example.clickhouse.cloud
      protocol: https
      port: 8443
      database: default
      databaseScope: all
      username: default
      password: "${CLICKHOUSE_PASSWORD}"
```

For local Docker, select `protocol: http` and port `8123`. Use the Compose service
name from the DSUI container; `localhost` refers to the DSUI host/container.
The existing [data-stack example](../../examples/data-stack) includes a service.

URL mode uses `method: url` and `url: https://host:8443/proxy-prefix`. The path is
always a proxy prefix; specify the database separately. URL userinfo is supported,
but cannot be combined with username/password fields or a bearer token. URL query
parameters are rejected; use the explicit settings below.

## Connection options

Both connection methods share these fields:

| Field | Default / behavior |
| --- | --- |
| `database` | `default` |
| `databaseScope` | `all` or `selected`; browsing scope, not an authorization boundary |
| `username`, `password` | `default` user and empty password when omitted |
| `accessToken` | Static bearer/JWT; mutually exclusive with basic/certificate authentication |
| `caCert` | Custom CA in PEM text; server verification remains enabled |
| `clientCert`, `clientKey` | PEM certificate/key pair; ClickHouse certificate authentication |
| `proxyUrl` | Outbound HTTP(S) proxy; HTTPS targets use CONNECT |
| `pathname` | Reverse-proxy prefix, starting with `/` |
| `requestTimeoutMs` | 70,000; bounded between 1,000 and 600,000 |
| `executionTimeoutSeconds` | 60; bounded between 1 and 600 |
| `maxConnections` | 10; separate cancellation connection reserved |
| `keepAlive`, `compression` | `true`; compression uses gzip |
| `readOnly` | `false`; `true` sends server-side `readonly=1` |
| `showSystemDatabases` | `false` |
| `roles` | Comma-separated role names |
| `headersJson` | JSON object of proxy headers; managed auth/transport headers prohibited |
| `settingsJson` | JSON object of ClickHouse settings; managed limits/session/format/auth settings prohibited |

Structured mode defaults to HTTPS/8443; explicitly choosing HTTP defaults to 8123.
URL mode respects URL ports (including standard 80/443 when omitted).
Static tokens are not automatically refreshed; expired tokens must be replaced.
Cloud control-plane API keys are not SQL credentials. Certificate values and
network endpoints are resolved by DSUI's server, not the browser. HTTP(S) proxies
use system trust for the proxy itself; `caCert` configures the target server.

VPNs, Cloud private endpoints, private DNS, Kubernetes port-forwarding, and external
SSH tunnels work when reachable from the DSUI process. Preserve the original TLS
hostname through tunnel/DNS configuration so certificate verification succeeds.
Native TCP/TLS ports (typically 9000/9440), direct SSH, gRPC, JDBC/ODBC, compatibility
protocols, embedded engines, built-in tunnels, and automatic token login are not
implemented transports. HTTP URLs never silently upgrade/downgrade or redirect.

## Pages and execution

- Overview, database/table explorer, column metadata, details, DDL, 100-row preview.
- Query editor with database selection, explorer, tabs, typed results, and CSV export.
- Active queries with five-second SDK-managed refresh and confirmed cancellation requests.
- Table-level parts, projections, skipping indexes and mutation inspection.

The editor accepts one statement per run. It rejects explicit `FORMAT` and
`INTO OUTFILE` tokens; quote identifiers named `format`. Sessions and temporary
state are not shared between requests. Ordinary SQL can change data with the
configured role's permissions. Use a restricted role for production inspection.

Query output defaults to 1,000 rows (10,000 maximum), with a 16 MiB response limit.
Oversized results fail explicitly instead of presenting silently truncated data.
The adapter bounds stream consumption and sends server-side result/execution
limits. Each response is parsed after its bounded stream completes; this is not
incremental result streaming to the browser. User-specified SQL settings and server
profiles can affect execution; use server-enforced role/profile constraints when
execution budgets must be authoritative. There are no automatic SQL retries.

Large integers and decimals remain strings. Column types are preserved; duplicate
column names receive deterministic suffixes. JSON values follow ClickHouse's JSON
format semantics. DDL and errors arriving after HTTP headers are checked before
reporting success. Client logs are disabled; external error details are translated
to safe diagnostics. Signals contain operation/database/duration/count, not SQL.
Catalog, DDL and activity content intentionally contain SQL visible to
the configured role.

Cancellation uses a separate connection and `KILL QUERY ... SYNC`. A request abort
also attempts asynchronous server cancellation; it reports that termination is
unconfirmed. Cancellation does not roll back writes. Distributed DDL and mutations
may continue after submission; monitor their inspection pages. Cluster execution is available through explicit SQL; metadata and inspection remain
endpoint-local.

## Verification

```sh
bun run --filter @northgraindata/dsui-adapter-clickhouse typecheck
bun run --filter @northgraindata/dsui-adapter-clickhouse test
CLICKHOUSE_TEST_URL=http://127.0.0.1:8123 bun run --filter @northgraindata/dsui-adapter-clickhouse test
```

Without `CLICKHOUSE_TEST_URL`, live integration cases are skipped. Transport tests
use local HTTP/TLS/proxy fixtures and OpenSSL. Live tests create and remove uniquely
named test databases/users; supply an isolated test instance with management rights.
See [COVERAGE.md](./COVERAGE.md) for the release ledger and remaining roadmap.
