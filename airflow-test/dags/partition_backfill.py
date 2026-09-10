"""Dynamic task mapping, so task instances carry a real map index."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from airflow.sdk import dag, task

log = logging.getLogger(__name__)

REGIONS = ["emea", "namer", "apac", "latam"]


@dag(
    dag_id="partition_backfill",
    dag_display_name="Partition backfill",
    description="Fans out one mapped task per region, then merges the results.",
    schedule="@daily",
    start_date=datetime(2026, 9, 7),
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "analytics", "retries": 1,
                  "retry_delay": timedelta(seconds=10)},
    tags=["production", "backfill"],
)
def partition_backfill() -> None:
    @task
    def list_regions() -> list[str]:
        return REGIONS

    @task
    def load_region(region: str) -> int:
        rows = 100 * (REGIONS.index(region) + 1)
        log.info("Loaded %s rows for %s", rows, region)
        return rows

    @task
    def merge(counts: list[int]) -> None:
        log.info("Merged %s partitions totalling %s rows", len(counts), sum(counts))

    merge(load_region.expand(region=list_regions()))


partition_backfill()
