select
    c.customer_id,
    c.name,
    c.segment,
    count(o.order_id) as order_count,
    coalesce(sum(o.amount), 0)::numeric(12, 2) as lifetime_value,
    max(o.ordered_at) as last_ordered_at
from {{ ref('stg_customers') }} c
left join {{ ref('stg_orders') }} o using (customer_id)
group by 1, 2, 3
