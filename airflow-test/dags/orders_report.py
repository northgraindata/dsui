"""Asset-scheduled DAG, so the adapter's asset pages have events to show."""

from __future__ import annotations

import logging
from datetime import datetime

from airflow.sdk import Asset, dag, task

log = logging.getLogger(__name__)

ORDERS = Asset("s3://dsui-test/warehouse/orders")
REPORT = Asset("s3://dsui-test/reports/orders_daily")


@dag(
    dag_id="orders_report",
    dag_display_name="Orders report",
    description="Rebuilds the orders report whenever the warehouse publishes.",
    schedule=[ORDERS],
    start_date=datetime(2026, 9, 6),
    catchup=False,
    tags=["reporting"],
)
def orders_report() -> None:
    @task
    def build_report() -> int:
        log.info("Building the orders report")
        return 42

    @task(outlets=[REPORT])
    def publish_report(rows: int) -> None:
        log.info("Published a report with %s rows", rows)

    publish_report(build_report())


orders_report()
