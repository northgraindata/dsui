import { describe, expect, test } from "bun:test";
import { awsClientConfig } from "./aws";

const base = { type: "aws-secrets-manager" as const };

describe("awsClientConfig", () => {
  test("without credentials, leaves them to the AWS default chain", () => {
    expect(awsClientConfig({ ...base, region: "eu-west-1" })).toEqual({
      region: "eu-west-1",
    });
  });

  test("passes explicit credentials to the client", () => {
    expect(
      awsClientConfig({
        ...base,
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
      }),
    ).toEqual({
      credentials: { accessKeyId: "AKIA", secretAccessKey: "secret" },
    });
  });

  test("includes a session token only when given", () => {
    expect(
      awsClientConfig({
        ...base,
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        sessionToken: "token",
        endpoint: "http://localhost:4566",
      }),
    ).toEqual({
      endpoint: "http://localhost:4566",
      credentials: {
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        sessionToken: "token",
      },
    });
  });
});
