select
    cast(customer_id as integer) as customer_id,
    name,
    segment
from {{ ref('customers') }}
