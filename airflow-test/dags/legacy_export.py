"""Starts paused, so the adapter's unpause and trigger actions have a target."""

from __future__ import annotations

import logging
from datetime import datetime

from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import dag, task

log = logging.getLogger(__name__)


@dag(
    dag_id="legacy_export",
    dag_display_name="Legacy export",
    description="Weekly CSV export kept switched off until someone needs it.",
    schedule="@weekly",
    start_date=datetime(2026, 8, 1),
    catchup=False,
    is_paused_upon_creation=True,
    default_args={"owner": "finance"},
    tags=["legacy"],
)
def legacy_export() -> None:
    @task
    def collect_rows() -> int:
        log.info("Collecting rows for the export")
        return 2_048

    write_csv = BashOperator(
        task_id="write_csv",
        bash_command="echo 'writing export.csv' && sleep 1",
    )

    collect_rows() >> write_csv


legacy_export()
