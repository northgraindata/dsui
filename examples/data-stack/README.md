# DSUI data-stack demo

Start the complete demonstration from the repository root:

```bash
docker compose -f examples/data-stack/compose.yaml up --build
```

Open <http://localhost:4192>. ClickHouse and DuckDB are configured in DSUI. Trino, Kafka, and MinIO run alongside them as companion services. The `events` Kafka topic and `warehouse/readme.txt` MinIO object are created during startup.

The credentials and encryption key in this example are development-only and must never be reused in another environment.

## ClickHouse sample data

With the ClickHouse service running, seed it from the repository root:

```bash
examples/data-stack/clickhouse/seed.sh
```

Requires Docker, Bash and Python 3. Defaults to container
`dsui-data-stack-clickhouse-1`, user `default`, password `dsui-test`; override with
`CLICKHOUSE_CONTAINER`, `CLICKHOUSE_USER` and `CLICKHOUSE_PASSWORD`.
The user needs database/table/dictionary creation and insertion rights.

The bootstrap creates six `demo_*` databases with about 5.9 million rows:

| Database | Fixtures |
| --- | --- |
| `demo_retail` | 100k customers, 2.5k products, 1m orders, joined view, product dictionary |
| `demo_analytics` | Materialized sales rollup, ordinary view, ReplacingMergeTree version history, SummingMergeTree and AggregatingMergeTree |
| `demo_telemetry` | 2m events, 2m metrics, 500k logs, monthly/daily partitions, timestamp compression and TTL |
| `demo_finance` | 250k transactions, exchange rates, large integer IDs and exact decimals |
| `demo_edge_cases` | Nullable/empty/Unicode values, arrays, maps, tuples, Nested, UUID, IPs, UInt128/Int128, high precision decimals, NaN/infinity, quoted identifiers, empty table, Memory/Log/TinyLog/CollapsingMergeTree |
| `demo_sandbox` | Empty database for empty states and manual experiments |

ClickHouse uses databases as schema namespaces; there are no nested schemas.
Orders include materialized/alias/default columns, a skipping index and a projection.
Rows and sizes in the catalog are metadata estimates; background merging reduces
rows in the replacing, summing and aggregating fixtures. All records are synthetic.

The script preserves existing objects and only inserts into empty tables, so rerunning
it does not duplicate the generated data. Run it without concurrent writers. It does
not repair changed definitions or partially populated tables. The sales materialized
view is installed before orders are inserted. Data survives container restarts;
recreating the demo container resets ClickHouse storage, so rerun the seed afterward.
Memory-engine rows disappear when ClickHouse restarts; rerun to refill them.

Try the statements in [clickhouse/queries.sql](clickhouse/queries.sql) individually
in DSUI. They cover joins, rollups, partitions, precision, dictionaries and cancellation.
The seed also populates query history. Replication, distributed clusters, Keeper,
external sources and backup destinations require additional infrastructure and are
not simulated by these fixtures. Background merges finish quickly; use the supplied
long-query example when testing live Activity.
