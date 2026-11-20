[Plugin SDK](../plugin-sdk) · [Source](./src/plugin.ts) · [DSUI](../../README.md)

# Secret managers plugin

Lets a connection field point at a secret in a secret manager, so DSUI reads the credential when it needs it and never stores it.

Package: `@northgraindata/dsui-plugin-secrets`. This is currently a private workspace package.

## Configure

```yaml
plugins:
  secrets:
    source: local
    path: ./packages/plugin-secrets
    config:
      providers:
        aws:
          type: aws-secrets-manager
          region: eu-west-1
          accessKeyId: ${AWS_ACCESS_KEY_ID}
          secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
```

Each key under `providers` is the name a reference uses, and `type` picks the secret manager.
Several entries of one type are allowed, for another region or account.
See the guide for the options and the full flow: [credentials from a secret manager](../../apps/docs/content/docs/guides/credentials-from-a-secret-manager.mdx).

## Supported types

| `type` | Source | Reference |
| --- | --- | --- |
| `aws-secrets-manager` | [`src/providers/aws.ts`](./src/providers/aws.ts) | A secret name or ARN, optionally followed by `#field` for a JSON secret |

AWS credentials are written under the provider, normally as `${NAME}` variables.
Without `accessKeyId` and `secretAccessKey`, the AWS default credential chain is used, for example an instance role.
The user or role needs `secretsmanager:GetSecretValue` on the secrets it reads.

`identity` is a third way to sign in, used by DSUI Cloud: `roleArn` names a role that trusts tokens the panel signs, `tokenUrl` is where the instance asks for one, and `token` is the bearer it presents.
The plugin exchanges the token for short-lived credentials with `AssumeRoleWithWebIdentity` and renews them before they expire, so no AWS key is written anywhere.
It cannot be combined with `accessKeyId`, `secretAccessKey` or `sessionToken`.

## Adding a secret manager

1. Add a file under `src/providers/` with a config schema (`type` is a literal) and a function that returns a `PluginSecretProvider`.
2. Add the schema to `providerSchema` and a case to `createProvider` in [`src/plugin.ts`](./src/plugin.ts).

A plugin outside this repository can offer a secret manager by calling `registry.secrets(provider)` itself.
