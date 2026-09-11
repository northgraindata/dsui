from datetime import datetime

from airflow.sdk import Asset, dag, task


orders_asset = Asset("s3://warehouse/orders_daily.parquet", group="warehouse")


@dag(
    dag_id="orders_pipeline",
    description="A realistic Airflow 3 DAG used by the dsui adapter fixture.",
    schedule="0 * * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["orders", "production"],
    default_args={"owner": "data-platform"},
)
def orders_pipeline():
    @task
    def extract_orders() -> list[dict[str, int]]:
        return [{"order_id": 1}, {"order_id": 2}, {"order_id": 3}]

    @task(outlets=[orders_asset])
    def publish_summary(order: dict[str, int]) -> str:
        return f"published order {order['order_id']}"

    publish_summary.expand(order=extract_orders())


orders_pipeline()
