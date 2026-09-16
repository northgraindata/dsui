select *
from {{ ref('stg_orders') }}
where status = 'paid' and amount <= 0
