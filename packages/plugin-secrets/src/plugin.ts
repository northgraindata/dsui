import {
  definePlugin,
  type PluginSecretProvider,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  AWS_LABEL,
  awsConfigSchema,
  awsCredentialProblem,
  awsSecretClient,
  createAwsProvider,
} from "./providers/aws.js";

/**
 * Secret managers that connection fields can point at.
 *
 * A field can hold a reference instead of a credential, so DSUI never stores
 * it. This plugin turns the entries under `providers` into secret managers:
 * each key is the name a reference uses, and `type` picks the implementation.
 * Several entries of one type are allowed, for another region or account.
 *
 * Supporting a new secret manager means adding its config schema to
 * `providerSchema` and a case to `createProvider`. A plugin from outside this
 * repository can offer one the same way through `registry.secrets()`.
 */
const providerSchema = z.discriminatedUnion("type", [awsConfigSchema]);

export const configSchema = z
  .object({
    providers: z
      .record(
        z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/, "a provider name must be kebab-case"),
        providerSchema,
      )
      .default({}),
  })
  .superRefine((config, context) => {
    for (const [name, entry] of Object.entries(config.providers)) {
      const problem = awsCredentialProblem(entry);
      if (problem)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["providers", name],
          message: problem,
        });
    }
  });

type Entry = z.infer<typeof providerSchema>;

const TYPE_LABELS: Record<Entry["type"], string> = {
  "aws-secrets-manager": AWS_LABEL,
};

/** The type's name, with the provider's own when several share a type. */
function labelFor(name: string, entry: Entry, all: Entry[]): string {
  if (entry.label) return entry.label;
  const typeLabel = TYPE_LABELS[entry.type];
  return all.filter((other) => other.type === entry.type).length > 1
    ? `${typeLabel} (${name})`
    : typeLabel;
}

function createProvider(name: string, entry: Entry, all: Entry[]) {
  const identity = { id: name, label: labelFor(name, entry, all) };
  switch (entry.type) {
    case "aws-secrets-manager": {
      const { read, list } = awsSecretClient(entry);
      return createAwsProvider(identity, read, list);
    }
  }
}

/** One secret manager for each entry under `providers`. */
export function providersFromConfig(
  config: z.infer<typeof configSchema>,
): PluginSecretProvider[] {
  const entries = Object.entries(config.providers);
  const all = entries.map(([, entry]) => entry);
  return entries.map(([name, entry]) => createProvider(name, entry, all));
}

export function createSecretsPlugin() {
  return definePlugin({
    metadata: {
      id: "secrets",
      name: "Secret managers",
      version: "1.0.0",
      apiVersion: 1,
    },
    configSchema,
    setup(registry, config) {
      for (const provider of providersFromConfig(config))
        registry.secrets(provider);
    },
  });
}

export default createSecretsPlugin();
