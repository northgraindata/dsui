"""Airflow 2.10 DAGs covering the DSUI adapter's supported resources."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta

from airflow.datasets import Dataset
from airflow.decorators import dag, task
from airflow.operators.bash import BashOperator

log = logging.getLogger(__name__)

ORDERS = Dataset("s3://dsui-test/warehouse/orders")
REPORT = Dataset("s3://dsui-test/reports/orders_daily")
START = datetime(2026, 9, 7)


@dag(
    dag_id="warehouse_daily",
    dag_display_name="Warehouse daily",
    description="Loads a small warehouse model and publishes an orders dataset.",
    schedule="@daily",
    start_date=START,
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "data-platform"},
    tags=["production", "warehouse"],
)
def warehouse_daily() -> None:
    @task
    def extract_orders() -> int:
        log.info("Read 1280 orders")
        time.sleep(2)
        return 1280

    @task
    def extract_customers() -> int:
        log.info("Read 864 customers")
        time.sleep(2)
        return 864

    @task(outlets=[ORDERS])
    def publish(orders: int, customers: int) -> None:
        log.info("Published warehouse from %s orders and %s customers", orders, customers)
        time.sleep(2)

    refresh = BashOperator(
        task_id="refresh_dashboard",
        bash_command="echo 'refreshing dashboard'",
    )
    published = publish(extract_orders(), extract_customers())
    published >> refresh


@dag(
    dag_id="orders_report",
    dag_display_name="Orders report",
    description="Rebuilds a report whenever the orders dataset updates.",
    schedule=[ORDERS],
    start_date=START,
    catchup=False,
    tags=["reporting"],
)
def orders_report() -> None:
    @task(outlets=[REPORT])
    def build_report() -> None:
        log.info("Published the daily orders report")

    build_report()


@dag(
    dag_id="partition_backfill",
    dag_display_name="Partition backfill",
    description="Fans out one mapped task per region.",
    schedule="@daily",
    start_date=START,
    catchup=False,
    max_active_runs=1,
    tags=["backfill"],
)
def partition_backfill() -> None:
    @task
    def load_region(region: str) -> str:
        log.info("Loaded region %s", region)
        return region

    load_region.expand(region=["emea", "namer", "apac", "latam"])


@dag(
    dag_id="flaky_ingest",
    dag_display_name="Flaky ingest",
    description="Fails deliberately so retries, clears, and logs can be tested.",
    schedule="@daily",
    start_date=START,
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "ingestion",
        "retries": 1,
        "retry_delay": timedelta(seconds=5),
    },
    tags=["unreliable"],
)
def flaky_ingest() -> None:
    @task
    def fetch_batch() -> int:
        return 500

    @task
    def load_batch(records: int) -> None:
        raise RuntimeError(f"upstream refused {records} records")

    load_batch(fetch_batch())


@dag(
    dag_id="legacy_export",
    dag_display_name="Legacy export",
    description="Paused workflow used for mutation checks.",
    schedule="@weekly",
    start_date=START,
    catchup=False,
    is_paused_upon_creation=True,
    tags=["legacy"],
)
def legacy_export() -> None:
    @task
    def collect_rows() -> int:
        log.info("Collected export rows")
        return 2048

    collect_rows()


warehouse_daily()
orders_report()
partition_backfill()
flaky_ingest()
legacy_export()
