import { describe, expect, test } from "bun:test";
import {
  type AssumedCredentials,
  type Identity,
  type IdentityDeps,
  identityCredentials,
  identitySchema,
} from "./aws-identity";

const identity: Identity = {
  roleArn: "arn:aws:iam::123456789012:role/DsuiCloudSecrets",
  tokenUrl: "https://panel.example/agent/v1/identity/token?manager=abc",
  token: "bearer-secret",
};

function setup(overrides: Partial<IdentityDeps> = {}) {
  let clock = 0;
  const calls = { tokens: 0, assumed: [] as string[] };
  const deps: IdentityDeps = {
    fetchToken: async () => {
      calls.tokens += 1;
      return `jwt-${calls.tokens}`;
    },
    assume: async (_role, token): Promise<AssumedCredentials> => {
      calls.assumed.push(token);
      return {
        accessKeyId: `key-${token}`,
        secretAccessKey: "secret",
        sessionToken: "session",
        expiration: new Date(clock + 3600_000),
      };
    },
    now: () => clock,
    ...overrides,
  };
  return {
    calls,
    provider: identityCredentials(identity, { region: "eu-west-1" }, deps),
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("identity configuration", () => {
  test("accepts a role ARN, a URL and a bearer", () => {
    expect(identitySchema.safeParse(identity).success).toBe(true);
  });

  test.each([
    [
      "a role ARN that is not a role",
      { roleArn: "arn:aws:iam::123456789012:user/x" },
    ],
    [
      "an account id that is not 12 digits",
      { roleArn: "arn:aws:iam::123:role/x" },
    ],
    ["a token URL that is not a URL", { tokenUrl: "nope" }],
    ["an empty bearer", { token: "" }],
    ["an unknown option", { extra: 1 }],
  ])("refuses %s", (_name, change) => {
    expect(identitySchema.safeParse({ ...identity, ...change }).success).toBe(
      false,
    );
  });
});

describe("identityCredentials", () => {
  test("exchanges a token for credentials once, and reuses them", async () => {
    const { provider, calls } = setup();
    const first = await provider();
    const second = await provider();
    expect(first).toBe(second);
    expect(first.accessKeyId).toBe("key-jwt-1");
    expect(calls.tokens).toBe(1);
  });

  test("replaces credentials shortly before they expire", async () => {
    const { provider, calls, advance } = setup();
    await provider();
    advance(3600_000 - 6 * 60_000);
    await provider();
    expect(calls.tokens).toBe(1);
    advance(2 * 60_000);
    const renewed = await provider();
    expect(calls.tokens).toBe(2);
    expect(renewed.accessKeyId).toBe("key-jwt-2");
  });

  test("concurrent requests share one exchange", async () => {
    const { provider, calls } = setup();
    await Promise.all([provider(), provider(), provider()]);
    expect(calls.tokens).toBe(1);
  });

  test("a failure is not remembered", async () => {
    let failing = true;
    const { provider, calls } = setup({
      fetchToken: async () => {
        calls.tokens += 1;
        if (failing)
          throw new Error("DSUI Cloud refused an identity token (status 401)");
        return "jwt";
      },
    });
    await expect(provider()).rejects.toThrow("status 401");
    failing = false;
    expect((await provider()).accessKeyId).toBe("key-jwt");
    expect(calls.tokens).toBe(2);
  });

  test("credentials without an expiry are kept", async () => {
    const { provider, calls, advance } = setup({
      assume: async () => ({ accessKeyId: "k", secretAccessKey: "s" }),
    });
    await provider();
    advance(10 * 3600_000);
    await provider();
    expect(calls.tokens).toBe(1);
  });

  test("passes the role and the client settings to the exchange", async () => {
    const seen: unknown[] = [];
    const { provider } = setup({
      assume: async (role, token, client) => {
        seen.push([role, token, client]);
        return { accessKeyId: "k", secretAccessKey: "s" };
      },
    });
    await provider();
    expect(seen).toEqual([
      [identity.roleArn, "jwt-1", { region: "eu-west-1" }],
    ]);
  });
});
