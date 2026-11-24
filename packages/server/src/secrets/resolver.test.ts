import { describe, expect, test } from "bun:test";
import type { PluginSecretProvider } from "@northgraindata/dsui-plugin-sdk";
import { SecretResolver } from "./resolver";

function provider(
  resolve: PluginSecretProvider["resolve"],
): PluginSecretProvider {
  return {
    id: "fake",
    label: "Fake Manager",
    reference: { label: "Name" },
    resolve,
  };
}

const request = { provider: "fake", reference: "db/password" };

describe("SecretResolver", () => {
  test("caches a value until it expires", async () => {
    let clock = 0;
    let calls = 0;
    const resolver = new SecretResolver({
      provider: () => provider(async () => `v${++calls}`),
      ttlMs: 1000,
      now: () => clock,
    });
    expect(await resolver.resolve(request)).toBe("v1");
    clock = 999;
    expect(await resolver.resolve(request)).toBe("v1");
    clock = 1000;
    expect(await resolver.resolve(request)).toBe("v2");
  });

  test("shares one lookup between concurrent callers", async () => {
    let calls = 0;
    const resolver = new SecretResolver({
      provider: () =>
        provider(async () => {
          calls += 1;
          await Bun.sleep(10);
          return "v";
        }),
    });
    await Promise.all([resolver.resolve(request), resolver.resolve(request)]);
    expect(calls).toBe(1);
  });

  test("does not cache a failure", async () => {
    let calls = 0;
    const resolver = new SecretResolver({
      provider: () =>
        provider(async () => {
          calls += 1;
          if (calls === 1) throw new Error("AccessDenied");
          return "ok";
        }),
    });
    await expect(resolver.resolve(request)).rejects.toThrow("AccessDenied");
    expect(await resolver.resolve(request)).toBe("ok");
  });

  test("names the provider when it is not installed", async () => {
    const resolver = new SecretResolver({ provider: () => undefined });
    await expect(resolver.resolve(request)).rejects.toThrow(
      'Secret provider "fake" is not installed',
    );
  });

  test("an error names the reference and never a value", async () => {
    const resolver = new SecretResolver({
      provider: () =>
        provider(async () => {
          throw new Error("not found");
        }),
    });
    await expect(resolver.resolve(request)).rejects.toThrow(
      'Could not read "db/password" from Fake Manager: not found',
    );
  });

  test("gives up on a provider that never answers", async () => {
    const resolver = new SecretResolver({
      provider: () => provider(() => new Promise<string>(() => undefined)),
      timeoutMs: 20,
    });
    await expect(resolver.resolve(request)).rejects.toThrow("timed out");
  });

  test("a connection without references is returned untouched", async () => {
    const resolver = new SecretResolver({ provider: () => undefined });
    const connection = { host: "h", password: "p" };
    expect(await resolver.resolveConnection(connection)).toBe(connection);
  });

  test("resolves references inside a connection", async () => {
    const resolver = new SecretResolver({
      provider: () => provider(async (reference) => `value:${reference}`),
    });
    expect(
      await resolver.resolveConnection({
        host: "h",
        password: { $secret: request },
      }),
    ).toEqual({ host: "h", password: "value:db/password" });
  });
});
