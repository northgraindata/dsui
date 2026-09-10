"""Branching DAG: the main subject for the adapter's dependency graph tab."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta

from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import Asset, dag, task

log = logging.getLogger(__name__)

ORDERS = Asset("s3://dsui-test/warehouse/orders")

default_args = {
    "owner": "data-platform",
    "retries": 1,
    "retry_delay": timedelta(seconds=10),
}


@dag(
    dag_id="warehouse_daily",
    dag_display_name="Warehouse daily",
    description="Loads the daily warehouse model from raw orders and events.",
    schedule="@daily",
    start_date=datetime(2026, 9, 6),
    catchup=False,
    max_active_runs=1,
    default_args=default_args,
    tags=["production", "warehouse"],
)
def warehouse_daily() -> None:
    @task
    def extract_orders() -> int:
        log.info("Reading orders from the source system")
        time.sleep(1)
        return 1_280

    @task
    def extract_events() -> int:
        log.info("Reading clickstream events")
        time.sleep(1)
        return 41_902

    @task
    def extract_customers() -> int:
        log.info("Reading the customer dimension")
        return 8_640

    @task
    def extract_inventory() -> int:
        log.info("Reading warehouse inventory levels")
        return 3_115

    @task
    def stage_orders(rows: int) -> int:
        log.info("Staged %s orders", rows)
        return rows

    @task
    def stage_events(rows: int) -> int:
        log.info("Staged %s events", rows)
        return rows

    @task
    def stage_customers(rows: int) -> int:
        log.info("Staged %s customers", rows)
        return rows

    @task
    def stage_inventory(rows: int) -> int:
        log.info("Staged %s inventory records", rows)
        return rows

    @task
    def quality_orders(orders: int, customers: int) -> str:
        if orders <= 0 or customers <= 0:
            raise ValueError("orders or customers staged empty")
        log.info("Order quality gate passed")
        return "passed"

    @task
    def quality_events(events: int) -> str:
        if events <= 0:
            raise ValueError("events staged empty")
        log.info("Event quality gate passed")
        return "passed"

    @task
    def build_core(orders_verdict: str, events_verdict: str, inventory: int) -> int:
        log.info(
            "Building core model (%s, %s) over %s inventory rows",
            orders_verdict,
            events_verdict,
            inventory,
        )
        time.sleep(1)
        return 53_937

    @task
    def mart_revenue(rows: int) -> str:
        log.info("Built the revenue mart from %s rows", rows)
        return "revenue"

    @task
    def mart_retention(rows: int) -> str:
        log.info("Built the retention mart from %s rows", rows)
        return "retention"

    @task
    def mart_inventory(rows: int) -> str:
        log.info("Built the inventory mart from %s rows", rows)
        return "inventory"

    @task
    def mart_marketing(rows: int) -> str:
        log.info("Built the marketing mart from %s rows", rows)
        return "marketing"

    @task(outlets=[ORDERS])
    def publish_marts(marts: list[str]) -> None:
        log.info("Published marts: %s", ", ".join(marts))
        time.sleep(1)

    refresh_dashboard = BashOperator(
        task_id="refresh_dashboard",
        task_display_name="Refresh dashboard",
        bash_command="echo 'warming the dashboard cache' && sleep 1",
    )
    export_csv = BashOperator(
        task_id="export_csv",
        bash_command="echo 'writing warehouse_daily.csv'",
    )
    warm_cache = BashOperator(
        task_id="warm_cache",
        bash_command="echo 'priming the query cache'",
    )
    notify = BashOperator(
        task_id="notify",
        trigger_rule="all_done",
        bash_command="echo 'warehouse_daily finished'",
    )

    orders = stage_orders(extract_orders())
    events = stage_events(extract_events())
    customers = stage_customers(extract_customers())
    inventory = stage_inventory(extract_inventory())

    core = build_core(
        quality_orders(orders, customers),
        quality_events(events),
        inventory,
    )
    published = publish_marts(
        [
            mart_revenue(core),
            mart_retention(core),
            mart_inventory(core),
            mart_marketing(core),
        ]
    )

    published >> [refresh_dashboard, export_csv, warm_cache] >> notify


warehouse_daily()
