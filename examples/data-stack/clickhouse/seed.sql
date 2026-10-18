-- Dedicated demo namespaces. Existing tables are preserved; inserts only fill empty tables.
-- ClickHouse databases are its schema namespace (there is no nested CREATE SCHEMA).
SET max_threads = 2;
SET max_insert_threads = 1;
SET max_memory_usage = 536870912;

CREATE DATABASE IF NOT EXISTS demo_retail;
CREATE DATABASE IF NOT EXISTS demo_analytics;
CREATE DATABASE IF NOT EXISTS demo_telemetry;
CREATE DATABASE IF NOT EXISTS demo_finance;
CREATE DATABASE IF NOT EXISTS demo_edge_cases;
CREATE DATABASE IF NOT EXISTS demo_sandbox;

CREATE TABLE IF NOT EXISTS demo_retail.customers (
    customer_id UInt64,
    email String,
    name String,
    country LowCardinality(String),
    tier Enum8('free' = 0, 'silver' = 1, 'gold' = 2),
    created_at DateTime,
    marketing_consent Bool,
    phone Nullable(String)
) ENGINE = MergeTree ORDER BY customer_id
COMMENT 'Synthetic customer directory with nullable and categorical fields';

CREATE TABLE IF NOT EXISTS demo_retail.products (
    product_id UInt32, sku String, name String, category LowCardinality(String),
    price Decimal(12, 2), tags Array(String), attributes Map(String, String)
) ENGINE = MergeTree ORDER BY product_id;

CREATE TABLE IF NOT EXISTS demo_retail.orders (
    order_id UInt64, customer_id UInt64, product_id UInt32,
    ordered_at DateTime64(3, 'UTC'), order_date Date MATERIALIZED toDate(ordered_at),
    country LowCardinality(String), status Enum8('paid' = 1, 'shipped' = 2, 'refunded' = 3, 'pending' = 4),
    quantity UInt16, amount Decimal(16, 2), discount Nullable(Decimal(8, 2)),
    channel LowCardinality(String), note String DEFAULT '',
    amount_with_tax Decimal(18, 2) ALIAS round(amount * 1.2, 2),
    INDEX customer_bloom customer_id TYPE bloom_filter(0.01) GRANULARITY 4,
    PROJECTION by_customer (SELECT customer_id, order_id, ordered_at, amount ORDER BY (customer_id, ordered_at))
) ENGINE = MergeTree PARTITION BY toYYYYMM(ordered_at)
ORDER BY (country, toDate(ordered_at), order_id)
SETTINGS index_granularity = 8192
COMMENT 'One million synthetic orders; monthly partitions, projection, skipping index and computed columns';

CREATE TABLE IF NOT EXISTS demo_analytics.daily_sales (
    day Date, country LowCardinality(String), orders UInt64, revenue Decimal(20, 2)
) ENGINE = SummingMergeTree PARTITION BY toYYYYMM(day) ORDER BY (day, country);

CREATE MATERIALIZED VIEW IF NOT EXISTS demo_analytics.daily_sales_mv
TO demo_analytics.daily_sales AS
SELECT toDate(ordered_at) AS day, country, count() AS orders, sum(amount) AS revenue
FROM demo_retail.orders GROUP BY day, country;

CREATE VIEW IF NOT EXISTS demo_retail.order_details AS
SELECT o.order_id, o.ordered_at, c.name AS customer, p.name AS product, o.amount, o.status
FROM demo_retail.orders AS o
LEFT JOIN demo_retail.customers AS c ON o.customer_id = c.customer_id
LEFT JOIN demo_retail.products AS p ON o.product_id = p.product_id;

CREATE VIEW IF NOT EXISTS demo_analytics.sales_by_country AS
SELECT country, sum(orders) AS orders, sum(revenue) AS revenue
FROM demo_analytics.daily_sales GROUP BY country;

CREATE TABLE IF NOT EXISTS demo_analytics.customer_versions (
    customer_id UInt64, version UInt64, segment LowCardinality(String), updated_at DateTime
) ENGINE = ReplacingMergeTree(version) ORDER BY customer_id;

CREATE TABLE IF NOT EXISTS demo_analytics.session_totals (
    day Date, sessions SimpleAggregateFunction(sum, UInt64),
    duration_seconds SimpleAggregateFunction(sum, Float64)
) ENGINE = AggregatingMergeTree ORDER BY day;

CREATE TABLE IF NOT EXISTS demo_telemetry.events (
    event_id UInt64, event_time DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
    event_type LowCardinality(String), user_id UInt64, session_id UUID,
    path String, country LowCardinality(String), device LowCardinality(String),
    properties Map(String, String), latency_ms UInt32, success Bool
) ENGINE = MergeTree PARTITION BY toYYYYMM(event_time)
ORDER BY (event_type, toDate(event_time), user_id, event_time)
TTL toDateTime(event_time) + INTERVAL 2 YEAR
COMMENT 'Two million application events; compressed timestamps, UUIDs, maps and TTL';

CREATE TABLE IF NOT EXISTS demo_telemetry.metrics (
    timestamp DateTime CODEC(Delta, ZSTD(1)), service LowCardinality(String),
    host LowCardinality(String), metric LowCardinality(String), value Float64,
    labels Map(String, String)
) ENGINE = MergeTree PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (service, metric, host, timestamp);

CREATE TABLE IF NOT EXISTS demo_telemetry.logs (
    timestamp DateTime64(6, 'UTC'), level Enum8('DEBUG' = 0, 'INFO' = 1, 'WARN' = 2, 'ERROR' = 3),
    service LowCardinality(String), trace_id FixedString(16), message String,
    exception Nullable(String)
) ENGINE = MergeTree PARTITION BY toYYYYMM(timestamp)
ORDER BY (service, toDate(timestamp), level, timestamp);

CREATE TABLE IF NOT EXISTS demo_finance.transactions (
    transaction_id UInt64, posted_at DateTime64(6, 'UTC'), account_id UInt64,
    currency FixedString(3), amount Decimal(24, 6), balance Decimal(30, 8),
    kind LowCardinality(String), reference Nullable(String)
) ENGINE = MergeTree PARTITION BY toYYYYMM(posted_at) ORDER BY (account_id, posted_at);

CREATE TABLE IF NOT EXISTS demo_finance.exchange_rates (
    day Date, currency FixedString(3), rate Decimal(18, 8)
) ENGINE = MergeTree ORDER BY (day, currency);

CREATE TABLE IF NOT EXISTS demo_edge_cases.type_showcase (
    id UInt64, huge_unsigned UInt128, huge_signed Int128, precise Decimal(38, 12),
    nullable_text Nullable(String), empty_text String, unicode_text String,
    boolean Bool, date Date, timestamp DateTime64(9, 'UTC'), uuid UUID,
    ipv4 IPv4, ipv6 IPv6, fixed FixedString(8), float_value Float64,
    array_values Array(Nullable(Int32)), map_values Map(String, Int64),
    tuple_value Tuple(label String, score Float64),
    nested_values Nested(key String, value UInt32), json_text String
) ENGINE = MergeTree ORDER BY id;

CREATE TABLE IF NOT EXISTS demo_edge_cases.`table with spaces` (
    `select` UInt64, `Customer Name` String, `format` String, `emoji 🚀` String
) ENGINE = MergeTree ORDER BY `select`;

CREATE TABLE IF NOT EXISTS demo_edge_cases.empty_table (
    id UUID, created_at DateTime64(3), description Nullable(String)
) ENGINE = MergeTree ORDER BY id;

CREATE TABLE IF NOT EXISTS demo_edge_cases.scratch_memory (
    id UInt32, label String
) ENGINE = Memory;

CREATE TABLE IF NOT EXISTS demo_edge_cases.tiny_log (
    timestamp DateTime, message String
) ENGINE = TinyLog;

CREATE TABLE IF NOT EXISTS demo_edge_cases.audit_log (
    id UInt64, action String
) ENGINE = Log;

CREATE TABLE IF NOT EXISTS demo_edge_cases.latest_status (
    id UInt64, sign Int8, status String
) ENGINE = CollapsingMergeTree(sign) ORDER BY id;

INSERT INTO demo_retail.customers
SELECT number + 1, concat('customer', toString(number + 1), '@example.test'),
    concat('Customer ', toString(number + 1)),
    ['US','PL','DE','GB','FR','JP'][number % 6 + 1],
    ['free','silver','gold'][number % 3 + 1],
    now() - toIntervalDay(number % 730), number % 3 != 0,
    if(number % 5 = 0, NULL, concat('+1555', leftPad(toString(number % 10000000), 7, '0')))
FROM numbers(100000) WHERE NOT EXISTS (SELECT 1 FROM demo_retail.customers LIMIT 1);

INSERT INTO demo_retail.products
SELECT number + 1, concat('SKU-', leftPad(toString(number), 6, '0')),
    concat(['Notebook','Keyboard','Monitor','Headphones','Camera'][number % 5 + 1], ' ', toString(number)),
    ['Electronics','Office','Home','Outdoor'][number % 4 + 1],
    toDecimal64((number % 50000 + 99) / 100, 2),
    ['demo', if(number % 2 = 0, 'popular', 'new')], map('color', ['black','white','blue'][number % 3 + 1], 'source', 'synthetic')
FROM numbers(2500) WHERE NOT EXISTS (SELECT 1 FROM demo_retail.products LIMIT 1);

INSERT INTO demo_retail.orders (order_id, customer_id, product_id, ordered_at, country, status, quantity, amount, discount, channel)
SELECT number + 1, number % 100000 + 1, number % 2500 + 1,
    now64(3) - toIntervalSecond((number * 17) % 15552000),
    ['US','PL','DE','GB','FR','JP'][number % 6 + 1],
    ['paid','shipped','refunded','pending'][number % 4 + 1], number % 5 + 1,
    toDecimal64((number % 99900 + 100) / 100, 2),
    if(number % 3 = 0, NULL, toDecimal64(number % 20, 2)),
    ['web','mobile','partner'][number % 3 + 1]
FROM numbers(1000000) WHERE NOT EXISTS (SELECT 1 FROM demo_retail.orders LIMIT 1);

INSERT INTO demo_analytics.customer_versions
SELECT number % 10000 + 1, intDiv(number, 10000) + 1,
    ['new','active','loyal'][intDiv(number, 10000) % 3 + 1], now() - toIntervalHour(10 - intDiv(number, 10000))
FROM numbers(100000) WHERE NOT EXISTS (SELECT 1 FROM demo_analytics.customer_versions LIMIT 1);

INSERT INTO demo_analytics.session_totals
SELECT today() - toIntervalDay(number % 90), toUInt64(number % 100 + 1), toFloat64(number % 600)
FROM numbers(10000) WHERE NOT EXISTS (SELECT 1 FROM demo_analytics.session_totals LIMIT 1);

INSERT INTO demo_telemetry.events
SELECT number + 1, now64(3) - toIntervalSecond((number * 13) % 15552000),
    ['page_view','click','signup','checkout','search'][number % 5 + 1], number % 100000 + 1,
    toUUID(concat('00000000-0000-4000-8000-', leftPad(hex(number % 100000), 12, '0'))),
    ['/','/products','/cart','/checkout','/account'][number % 5 + 1],
    ['US','PL','DE','GB','FR','JP'][number % 6 + 1], ['desktop','mobile','tablet'][number % 3 + 1],
    map('campaign', ['organic','summer','newsletter'][number % 3 + 1], 'version', '2.4.1'),
    cityHash64(number) % 2000, number % 37 != 0
FROM numbers(2000000) WHERE NOT EXISTS (SELECT 1 FROM demo_telemetry.events LIMIT 1);

INSERT INTO demo_telemetry.metrics
SELECT now() - toIntervalSecond(number % 604800),
    ['api','worker','frontend','payments'][number % 4 + 1], concat('host-', toString(number % 20)),
    ['cpu_percent','memory_mb','requests_per_second','queue_depth'][intDiv(number, 4) % 4 + 1],
    (cityHash64(number) % 100000) / 100.0, map('environment', 'staging', 'region', ['eu','us'][number % 2 + 1])
FROM numbers(2000000) WHERE NOT EXISTS (SELECT 1 FROM demo_telemetry.metrics LIMIT 1);

INSERT INTO demo_telemetry.logs
SELECT now64(6) - toIntervalSecond(number % 604800), ['DEBUG','INFO','WARN','ERROR'][number % 4 + 1],
    ['api','worker','frontend','payments'][number % 4 + 1], unhex(leftPad(hex(number), 32, '0')),
    concat(['Request completed','Job scheduled','Retry requested','Upstream timeout'][number % 4 + 1], ' route=', toString(number % 100)),
    if(number % 4 = 3, 'SyntheticTimeout: demo upstream exceeded deadline', NULL)
FROM numbers(500000) WHERE NOT EXISTS (SELECT 1 FROM demo_telemetry.logs LIMIT 1);

INSERT INTO demo_finance.transactions
SELECT toUInt64(9007199254740993) + number, now64(6) - toIntervalSecond((number * 67) % 15552000), number % 10000 + 1,
    ['USD','EUR','PLN','GBP'][number % 4 + 1],
    toDecimal128(number % 1000000 - toInt64(500000), 6) / 100,
    toDecimal128('123456789012345678.12345678', 8),
    ['credit','debit','refund'][number % 3 + 1], if(number % 7 = 0, NULL, concat('REF-', toString(number)))
FROM numbers(250000) WHERE NOT EXISTS (SELECT 1 FROM demo_finance.transactions LIMIT 1);

INSERT INTO demo_finance.exchange_rates
SELECT today() - toIntervalDay(intDiv(number, 4)), ['USD','EUR','PLN','GBP'][number % 4 + 1],
    toDecimal64([1.0, 0.92, 4.01, 0.79][number % 4 + 1], 8)
FROM numbers(360) WHERE NOT EXISTS (SELECT 1 FROM demo_finance.exchange_rates LIMIT 1);

INSERT INTO demo_edge_cases.type_showcase
SELECT number, toUInt128('340282366920938463463374607431768211455') - number,
    toInt128('-170141183460469231731687303715884105728') + number,
    toDecimal128('12345678901234567890123456.123456789012', 12),
    if(number % 2 = 0, NULL, 'present'), '',
    ['Zażółć gęślą jaźń 🚀','日本語テスト','مرحبا بالعالم','Line one\nLine two\tTab'][number % 4 + 1],
    number % 2 = 0, today(), now64(9),
    toUUID(concat('00000000-0000-4000-8000-', leftPad(hex(number), 12, '0'))),
    toIPv4('192.0.2.1'), toIPv6('2001:db8::1'), 'fixed',
    if(number = 0, toFloat64('nan'), if(number = 1, toFloat64('inf'), -123.456)),
    [toNullable(toInt32(1)), NULL, toNullable(toInt32(-3))], map('positive', toInt64(1), 'negative', toInt64(-1)),
    tuple('sample', 0.95), ['alpha','beta'], [toUInt32(1), toUInt32(2)], '{"nested":{"ok":true},"items":[1,null,3]}'
FROM numbers(12) WHERE NOT EXISTS (SELECT 1 FROM demo_edge_cases.type_showcase LIMIT 1);

INSERT INTO demo_edge_cases.`table with spaces`
SELECT number, 'Quoted identifiers', 'json', '🚀' FROM numbers(5)
WHERE NOT EXISTS (SELECT 1 FROM demo_edge_cases.`table with spaces` LIMIT 1);
INSERT INTO demo_edge_cases.scratch_memory SELECT number, concat('temporary-', toString(number)) FROM numbers(25)
WHERE NOT EXISTS (SELECT 1 FROM demo_edge_cases.scratch_memory LIMIT 1);
INSERT INTO demo_edge_cases.tiny_log SELECT now(), 'Synthetic audit entry' FROM numbers(20)
WHERE NOT EXISTS (SELECT 1 FROM demo_edge_cases.tiny_log LIMIT 1);
INSERT INTO demo_edge_cases.audit_log SELECT number, 'demo.login' FROM numbers(20)
WHERE NOT EXISTS (SELECT 1 FROM demo_edge_cases.audit_log LIMIT 1);
INSERT INTO demo_edge_cases.latest_status SELECT number, toInt8(1), 'active' FROM numbers(100)
WHERE NOT EXISTS (SELECT 1 FROM demo_edge_cases.latest_status LIMIT 1);

CREATE DICTIONARY IF NOT EXISTS demo_retail.product_lookup (
    product_id UInt64, name String, category String, price Decimal(12, 2)
) PRIMARY KEY product_id
SOURCE(CLICKHOUSE(HOST 'localhost' PORT 9000 USER __DSUI_SEED_USER__ PASSWORD __DSUI_SEED_PASSWORD__
    DB 'demo_retail' TABLE 'products'))
LAYOUT(HASHED()) LIFETIME(MIN 300 MAX 600);

-- Exercise successful, cross-database and complex-type query-log entries.
SELECT country, count(), sum(amount) FROM demo_retail.orders GROUP BY country;
SELECT event_type, count(), quantile(0.95)(latency_ms) FROM demo_telemetry.events GROUP BY event_type;
SELECT * FROM demo_retail.order_details LIMIT 3;
SELECT * FROM demo_edge_cases.type_showcase LIMIT 1;
SELECT dictGet('demo_retail.product_lookup', 'name', toUInt64(1));
SYSTEM FLUSH LOGS;

SELECT database, count() AS relations, sum(total_rows) AS estimated_rows,
    formatReadableSize(sum(total_bytes)) AS size
FROM system.tables WHERE startsWith(database, 'demo_') GROUP BY database ORDER BY database;
