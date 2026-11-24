---
"@northgraindata/dsui-plugin-sdk": minor
"@northgraindata/dsui-server": minor
---

Let a connection field point at a secret in a secret manager instead of holding the credential.
Plugins add secret managers with `registry.secrets()`, and the connection form offers them on every field.
A secret provider can also implement `search()`, so the form suggests secrets while a person types.
A first-party secrets plugin with AWS Secrets Manager support is included.
