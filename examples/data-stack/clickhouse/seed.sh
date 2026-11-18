#!/usr/bin/env bash
set -euo pipefail

# This script targets the isolated data-stack demo container by default.
seed_container="${CLICKHOUSE_CONTAINER:-dsui-data-stack-clickhouse-1}"
seed_user="${CLICKHOUSE_USER:-default}"
seed_password="${CLICKHOUSE_PASSWORD:-dsui-test}"
seed_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Dictionary source credentials are SQL literals; escape them rather than using shell substitution.
DSUI_SEED_USER="$seed_user" DSUI_SEED_PASSWORD="$seed_password" python3 -c '
import os, pathlib, sys
sql = pathlib.Path(sys.argv[1]).read_text()
for key in ("USER", "PASSWORD"):
    value = os.environ["DSUI_SEED_" + key]
    literal = "\x27" + value.replace("\\", "\\\\").replace("\x27", "\\\x27") + "\x27"
    sql = sql.replace("__DSUI_SEED_" + key + "__", literal)
sys.stdout.write(sql)
' "$seed_dir/seed.sql" | docker exec -i "$seed_container" clickhouse-client \
  --user "$seed_user" --password "$seed_password" --multiquery
