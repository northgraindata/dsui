# Capability Map: ClickHouse Workspace

| Module id | Responsibility | Depends on |
|---|---|---|
| `clickhouse-shell` | ClickHouse workspace navigation, nested object routes, breadcrumbs, and tabs | — |
| `clickhouse-explorer` | Database tree and table workspace with overview, columns, data, DDL, and parts | `clickhouse-shell` |
| `clickhouse-query` | Multi-tab SQL editor, schema-aware completion, history, cancellation, and structured errors | `clickhouse-explorer` |
| `clickhouse-operations` | Cluster topology, replicas, merges, mutations, running queries, disks, and errors | `clickhouse-shell` |
| `clickhouse-insights` | Time-range query-log KPIs, trends, failures, heavy queries, users, and hot tables | `clickhouse-operations` |
| `clickhouse-governance` | Users, roles, grants, access matrix, and guarded administration | `clickhouse-shell` |
| `clickhouse-schema-admin` | Create/drop databases and tables, followed by guided data import | `clickhouse-explorer` |

Build order: `clickhouse-shell` → `clickhouse-explorer` → `clickhouse-query` →
`clickhouse-operations` → `clickhouse-insights` → `clickhouse-governance` →
`clickhouse-schema-admin`.

The first milestone covers `clickhouse-shell` and `clickhouse-explorer`. The
remaining modules stay independently specifiable and shippable.
