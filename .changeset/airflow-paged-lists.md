---
"@northgraindata/dsui-adapter-sdk": minor
---

`List` and `Table` can page on the server with `paged`. The resource accepts `pageInput` (`limit`, `offset`, `search`, plus one field per declared filter) and returns a `Page` (`items`, `total`). Only the shown page is fetched and kept in the browser.

The shared dropdown is compact, matches other inputs, and opens wide only when its options have descriptions.

Icon-sized buttons no longer squeeze their icon.

The Airflow adapter now pages DAGs, DAG runs, assets, asset events, connections, variables, pools, users and the event log. Before, every list except DAGs stopped at 100 records without saying so, and the event log showed the oldest 100 events. Task lists and task graphs read all tasks. On Airflow 2, searching connections, variables or pools reads the whole list, because its API has no search for them, and the event log search needs a whole DAG ID. The overview shows 10 DAGs. The owner and connection type filters were removed, because they would only have filtered one page.
