import { describe, expect, test } from "bun:test";
import { configSchema, providersFromConfig } from "./plugin";

const providers = (input: unknown) =>
  providersFromConfig(configSchema.parse(input));

describe("secret manager configuration", () => {
  test("no providers registers nothing", () => {
    expect(providers({})).toEqual([]);
  });

  test("each entry becomes a provider named by its key", () => {
    const [aws] = providers({
      providers: { "prod-aws": { type: "aws-secrets-manager" } },
    });
    expect(aws?.id).toBe("prod-aws");
    expect(aws?.label).toBe("AWS Secrets Manager");
  });

  test("several of one type tell their labels apart", () => {
    const found = providers({
      providers: {
        "aws-eu": { type: "aws-secrets-manager", region: "eu-west-1" },
        "aws-us": { type: "aws-secrets-manager", region: "us-east-1" },
      },
    });
    expect(found.map((provider) => provider.label)).toEqual([
      "AWS Secrets Manager (aws-eu)",
      "AWS Secrets Manager (aws-us)",
    ]);
  });

  test("an explicit label wins", () => {
    const [aws] = providers({
      providers: {
        aws: { type: "aws-secrets-manager", label: "Production secrets" },
      },
    });
    expect(aws?.label).toBe("Production secrets");
  });

  test.each([
    ["an access key without its secret", { accessKeyId: "AKIA" }],
    ["a secret without its access key", { secretAccessKey: "s" }],
    ["a session token alone", { sessionToken: "t" }],
  ])("refuses %s", (_name, credentials) => {
    expect(
      configSchema.safeParse({
        providers: { aws: { type: "aws-secrets-manager", ...credentials } },
      }).success,
    ).toBe(false);
  });

  test("accepts an identity, and refuses it next to static credentials", () => {
    const identity = {
      roleArn: "arn:aws:iam::123456789012:role/DsuiCloudSecrets",
      tokenUrl: "https://panel.example/agent/v1/identity/token?manager=abc",
      token: "secret",
    };
    const entry = (extra: object) => ({
      providers: { aws: { type: "aws-secrets-manager", identity, ...extra } },
    });
    expect(configSchema.safeParse(entry({})).success).toBe(true);
    expect(
      configSchema.safeParse(
        entry({ accessKeyId: "AKIA", secretAccessKey: "s" }),
      ).success,
    ).toBe(false);
    expect(configSchema.safeParse(entry({ sessionToken: "t" })).success).toBe(
      false,
    );
  });

  test("accepts explicit credentials, with or without a session token", () => {
    for (const extra of [{}, { sessionToken: "t" }])
      expect(
        configSchema.safeParse({
          providers: {
            aws: {
              type: "aws-secrets-manager",
              accessKeyId: "AKIA",
              secretAccessKey: "s",
              ...extra,
            },
          },
        }).success,
      ).toBe(true);
  });

  test.each([
    ["an unknown type", { providers: { x: { type: "nope" } } }],
    [
      "a name that is not kebab-case",
      { providers: { "Prod AWS": { type: "aws-secrets-manager" } } },
    ],
    [
      "an unknown option",
      { providers: { x: { type: "aws-secrets-manager", regoin: "eu" } } },
    ],
    ["a missing type", { providers: { x: {} } }],
    [
      "an invalid endpoint",
      { providers: { x: { type: "aws-secrets-manager", endpoint: "nope" } } },
    ],
  ])("refuses %s", (_name, input) => {
    expect(configSchema.safeParse(input).success).toBe(false);
  });
});
