import { describe, expect, test } from "bun:test";
import type { PluginSecretProvider } from "@northgraindata/dsui-plugin-sdk";
import { SecretSuggestions } from "./suggestions";

function provider(
  search: PluginSecretProvider["search"],
): PluginSecretProvider {
  return {
    id: "fake",
    label: "Fake",
    reference: { label: "Name" },
    resolve: async () => "unused",
    ...(search ? { search } : {}),
  };
}

describe("SecretSuggestions", () => {
  test("returns what the provider lists", async () => {
    const suggestions = new SecretSuggestions({
      provider: () =>
        provider(async (query) => [
          { reference: `${query}one`, label: "One", description: "First" },
        ]),
    });
    expect(await suggestions.suggest("fake", "db/")).toEqual({
      available: true,
      items: [{ reference: "db/one", label: "One", description: "First" }],
    });
  });

  test("a provider without search is not available", async () => {
    const suggestions = new SecretSuggestions({
      provider: () => provider(undefined),
    });
    expect(await suggestions.suggest("fake", "")).toEqual({
      available: false,
      items: [],
    });
  });

  test("a failure is the check: it is remembered and not asked again", async () => {
    let clock = 0;
    let calls = 0;
    const suggestions = new SecretSuggestions({
      provider: () =>
        provider(async () => {
          calls += 1;
          throw new Error("AccessDeniedException");
        }),
      retryAfterMs: 1000,
      now: () => clock,
    });
    expect((await suggestions.suggest("fake", "a")).available).toBe(false);
    expect((await suggestions.suggest("fake", "ab")).available).toBe(false);
    expect((await suggestions.suggest("fake", "abc")).available).toBe(false);
    expect(calls).toBe(1);
    clock = 1000;
    await suggestions.suggest("fake", "abcd");
    expect(calls).toBe(2);
  });

  test("a later success clears the memory of a failure", async () => {
    let clock = 0;
    let allowed = false;
    const suggestions = new SecretSuggestions({
      provider: () =>
        provider(async () => {
          if (!allowed) throw new Error("denied");
          return [{ reference: "a" }];
        }),
      retryAfterMs: 1000,
      now: () => clock,
    });
    expect((await suggestions.suggest("fake", "")).available).toBe(false);
    allowed = true;
    clock = 1000;
    expect((await suggestions.suggest("fake", "")).available).toBe(true);
    expect((await suggestions.suggest("fake", "")).available).toBe(true);
  });

  test("a provider that never answers counts as unavailable", async () => {
    const suggestions = new SecretSuggestions({
      provider: () => provider(() => new Promise(() => undefined)),
      timeoutMs: 20,
    });
    expect((await suggestions.suggest("fake", "")).available).toBe(false);
  });

  test("limits the number of entries and drops malformed ones", async () => {
    const suggestions = new SecretSuggestions({
      provider: () =>
        provider(async () => [
          ...Array.from({ length: 80 }, (_, index) => ({
            reference: `s${index}`,
          })),
          { reference: "" },
          { nope: true } as never,
        ]),
    });
    const result = await suggestions.suggest("fake", "");
    expect(result.items).toHaveLength(50);
  });

  test("an unknown provider is an error, not an empty list", async () => {
    const suggestions = new SecretSuggestions({ provider: () => undefined });
    await expect(suggestions.suggest("nope", "")).rejects.toThrow(
      'Secret provider "nope" is not installed',
    );
  });
});
