# Inspect a data catalog

Use this guide for questions about databases, schemas, tables, columns, model
metadata, sample rows, or resource inventory.

1. List relevant services and call `discover_resources` for each one. Follow
   discovery pagination before claiming a resource does not exist.
2. Prefer metadata resources for inventory and column questions. Use preview
   resources only when the user needs actual sample rows. Respect each
   resource's input schema, availability, and pagination rules.
3. Keep service, database, and schema with every table name so identically
   named tables are not confused. Include verified table links supplied in
   resource navigation metadata.
4. Mark partial, estimated, redacted, or truncated data as such. Do not infer
   constraints, counts, or representative examples from a small preview.

Apply the always-on response format instructions to schema and preview tables.
