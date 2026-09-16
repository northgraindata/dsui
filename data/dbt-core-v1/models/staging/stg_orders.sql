select
    cast(order_id as integer) as order_id,
    cast(customer_id as integer) as customer_id,
    cast(ordered_at as date) as ordered_at,
    cast(amount as numeric(12, 2)) as amount,
    status
from {{ ref('orders') }}
