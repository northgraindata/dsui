# Snowflake adapter

The Snowflake adapter offers two connection methods: **Key pair authentication
(JWT)** and **Password-based authentication**. Both use a Snowflake account
identifier, database, and login name. Schema, warehouse, and role are optional.

Add the adapter to `data/dsui.yaml`:

```yaml
adapters:
  snowflake:
    source: local
    path: ./packages/adapter-snowflake
```

For **Key pair authentication (JWT)**, enter the path to a private key file on
the DSUI server. The corresponding public key must be assigned to the Snowflake
user. Supply the private key passphrase if the file is encrypted.

For **Password-based authentication**, enter the user's Snowflake login name
and password. The optional passcode is for Duo MFA; a Google Authenticator code
cannot be verified through the Snowflake Node.js driver's password passcode
option.

Optional connection settings: `readOnly` (blocks writes, cancel and warehouse
changes) and `statementTimeoutSeconds` (default 60).

The Cost & usage page reads `SNOWFLAKE.ACCOUNT_USAGE` and needs
`GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE <role>`. Warehouse
controls need `OPERATE`/`MODIFY` on the warehouse.

Run
`bun run --filter @northgraindata/dsui-adapter-snowflake typecheck` and
`bun run --filter @northgraindata/dsui-adapter-snowflake test` from the
repository root.
