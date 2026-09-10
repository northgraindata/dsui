"""Always leaves one failed task instance, for the retry and clear actions."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from airflow.sdk import dag, task

log = logging.getLogger(__name__)


@dag(
    dag_id="flaky_ingest",
    dag_display_name="Flaky ingest",
    description="Fails on purpose so retry, clear, and multi-try logs are testable.",
    schedule="@daily",
    start_date=datetime(2026, 9, 8),
    catchup=False,
    max_active_runs=1,
    default_args={"owner": "ingestion", "retries": 1,
                  "retry_delay": timedelta(seconds=10)},
    tags=["unreliable"],
)
def flaky_ingest() -> None:
    @task
    def fetch_batch() -> int:
        log.info("Fetched a batch of 500 records")
        return 500

    @task
    def load_batch(records: int) -> None:
        log.warning("Upstream API is refusing %s records", records)
        raise RuntimeError("upstream returned 503 Service Unavailable")

    @task(trigger_rule="all_done")
    def report_outcome() -> None:
        log.info("Recording the ingest outcome regardless of failures")

    batch = fetch_batch()
    load_batch(batch) >> report_outcome()


flaky_ingest()
