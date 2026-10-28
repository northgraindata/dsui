-- Run one statement at a time in the DSUI query editor.

-- Cross-database join.
SELECT o.country, p.category, count() AS orders, sum(o.amount) AS revenue
FROM demo_retail.orders AS o
INNER JOIN demo_retail.products AS p ON o.product_id = p.product_id
GROUP BY o.country, p.category ORDER BY revenue DESC;

-- Materialized sales rollup.
SELECT country, sum(orders) AS orders, sum(revenue) AS revenue
FROM demo_analytics.daily_sales GROUP BY country ORDER BY revenue DESC;

-- Partition and compression inspection.
SELECT database, table, partition, sum(rows) AS rows,
    formatReadableSize(sum(bytes_on_disk)) AS disk_size
FROM system.parts WHERE active AND startsWith(database, 'demo_')
GROUP BY database, table, partition ORDER BY database, table, partition;

-- Event latency distribution.
SELECT event_type, count() AS events,
    quantiles(0.5, 0.95, 0.99)(latency_ms) AS latency_percentiles
FROM demo_telemetry.events GROUP BY event_type;

-- Exact values beyond JavaScript Number precision.
SELECT transaction_id, amount, balance FROM demo_finance.transactions LIMIT 10;

-- Nested values, Unicode, nulls, infinities and large integers.
SELECT * FROM demo_edge_cases.type_showcase;

-- Quoted identifiers and reserved column names.
SELECT `select`, `Customer Name`, `format`, `emoji 🚀`
FROM demo_edge_cases.`table with spaces`;

-- Dictionary lookup.
SELECT dictGet('demo_retail.product_lookup', 'name', toUInt64(42));

-- Bounded long query for testing Activity and cancellation (runs for about 20 seconds).
SELECT sleepEachRow(0.1) FROM numbers(200) SETTINGS max_block_size = 1;
