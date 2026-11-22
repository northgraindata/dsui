import {
  GetSecretValueCommand,
  ListSecretsCommand,
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import type {
  PluginSecretProvider,
  PluginSecretSuggestion,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { identityCredentials, identitySchema } from "./aws-identity.js";
import { parseReference } from "./aws-reference.js";

export const AWS_TYPE = "aws-secrets-manager";
export const AWS_LABEL = "AWS Secrets Manager";

export const awsConfigSchema = z
  .object({
    type: z.literal(AWS_TYPE),
    /** Shown in the connection form. Defaults to the provider's name. */
    label: z.string().min(1).optional(),
    /** Defaults to the region the AWS credential chain finds. */
    region: z.string().min(1).optional(),
    /** For local emulators such as LocalStack. */
    endpoint: z.string().url().optional(),
    /**
     * Credentials, normally written as `${AWS_ACCESS_KEY_ID}` and the like.
     * Leave all three out to use the AWS default chain instead: an instance or
     * task role, a web identity token file, or an SSO profile.
     */
    accessKeyId: z.string().min(1).optional(),
    secretAccessKey: z.string().min(1).optional(),
    sessionToken: z.string().min(1).optional(),
    /**
     * Credentials from a token DSUI Cloud signs, for an instance that has no
     * AWS key. Cannot be combined with the three above.
     */
    identity: identitySchema.optional(),
  })
  .strict();
export type AwsConfig = z.infer<typeof awsConfigSchema>;

/** Fetches a secret's `SecretString`; the AWS client is behind this seam. */
export type ReadSecretString = (
  secretId: string,
  signal: AbortSignal | undefined,
) => Promise<string | undefined>;

/** What is wrong with the credentials in an entry, or null when it is fine. */
export function awsCredentialProblem(config: AwsConfig): string | null {
  const { accessKeyId, secretAccessKey, sessionToken, identity } = config;
  if (identity && (accessKeyId || secretAccessKey || sessionToken))
    return "identity cannot be combined with accessKeyId, secretAccessKey or sessionToken";
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey))
    return "accessKeyId and secretAccessKey must be given together";
  if (sessionToken && !accessKeyId)
    return "sessionToken needs accessKeyId and secretAccessKey";
  return null;
}

export function awsClientConfig(config: AwsConfig): SecretsManagerClientConfig {
  return {
    ...(config.region ? { region: config.region } : {}),
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.identity
      ? {
          credentials: identityCredentials(config.identity, {
            ...(config.region ? { region: config.region } : {}),
            ...(config.endpoint ? { endpoint: config.endpoint } : {}),
          }),
        }
      : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            ...(config.sessionToken
              ? { sessionToken: config.sessionToken }
              : {}),
          },
        }
      : {}),
  };
}

/** Lists secrets whose name starts with `prefix`; the AWS client is behind this seam. */
export type ListSecretNames = (
  prefix: string,
  signal: AbortSignal | undefined,
) => Promise<Array<{ name: string; description?: string }>>;

const LIST_PAGE_SIZE = 20;

export function awsSecretClient(config: AwsConfig): {
  read: ReadSecretString;
  list: ListSecretNames;
} {
  const client = new SecretsManagerClient(awsClientConfig(config));
  return {
    read: async (secretId, signal) => {
      const result = await client.send(
        new GetSecretValueCommand({ SecretId: secretId }),
        signal ? { abortSignal: signal } : {},
      );
      return result.SecretString;
    },
    list: async (prefix, signal) => {
      const result = await client.send(
        new ListSecretsCommand({
          MaxResults: LIST_PAGE_SIZE,
          SortOrder: "asc",
          ...(prefix ? { Filters: [{ Key: "name", Values: [prefix] }] } : {}),
        }),
        signal ? { abortSignal: signal } : {},
      );
      return (result.SecretList ?? []).flatMap((entry) =>
        entry.Name
          ? [
              {
                name: entry.Name,
                ...(entry.Description
                  ? { description: entry.Description }
                  : {}),
              },
            ]
          : [],
      );
    },
  };
}

export function createAwsProvider(
  identity: { id: string; label: string },
  read: ReadSecretString,
  list?: ListSecretNames,
): PluginSecretProvider {
  return {
    id: identity.id,
    label: identity.label,
    description: "Read the value from AWS Secrets Manager when it is needed.",
    reference: {
      label: "Secret",
      placeholder: "prod/airflow#password",
      hint: "A secret name or ARN. Add #key to read one field of a JSON secret.",
    },
    ...(list
      ? {
          // Needs secretsmanager:ListSecrets; the host falls back to a plain
          // input when the role does not have it.
          async search(query, { signal }): Promise<PluginSecretSuggestion[]> {
            const prefix = query.split("#")[0]?.trim() ?? "";
            const found = await list(prefix, signal);
            return found.map(({ name, description }) => ({
              reference: name,
              ...(description ? { description } : {}),
            }));
          },
        }
      : {}),
    async resolve(reference, { signal }) {
      const { secretId, key } = parseReference(reference);
      const secret = await read(secretId, signal);
      if (secret === undefined)
        throw new Error(
          "the secret has no text value (binary secrets are not supported)",
        );
      if (key === undefined) return secret;
      let parsed: unknown;
      try {
        parsed = JSON.parse(secret);
      } catch {
        throw new Error("a key was given but the secret is not JSON");
      }
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new Error("a key was given but the secret is not a JSON object");
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value !== "string")
        throw new Error(`the secret has no text field "${key}"`);
      return value;
    },
  };
}
