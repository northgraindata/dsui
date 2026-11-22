import { describe, expect, test } from "bun:test";
import {
  containsReferences,
  isSecretReference,
  resolveReferences,
  restoreReferences,
} from "./reference";

const ref = (reference: string) => ({
  $secret: { provider: "aws", reference },
});

describe("secret references", () => {
  test("recognises exactly the reference shape", () => {
    expect(isSecretReference(ref("a"))).toBe(true);
    expect(isSecretReference({ $secret: { provider: "x" } })).toBe(false);
    expect(isSecretReference({ ...ref("a"), extra: 1 })).toBe(false);
    expect(isSecretReference("a")).toBe(false);
    expect(isSecretReference(null)).toBe(false);
  });

  test("finds references at any depth", () => {
    expect(containsReferences({ host: "h", password: ref("p") })).toBe(true);
    expect(containsReferences({ a: { b: [{ c: ref("p") }] } })).toBe(true);
    expect(containsReferences({ host: "h", port: 5432 })).toBe(false);
  });

  test("resolves nested references and leaves other values alone", async () => {
    const result = await resolveReferences(
      { host: "h", port: 5432, auth: { password: ref("p") }, list: [ref("q")] },
      async ({ reference }) => `value-of-${reference}`,
    );
    expect(result).toEqual({
      host: "h",
      port: 5432,
      auth: { password: "value-of-p" },
      list: ["value-of-q"],
    });
  });

  test("restores references over validated values", () => {
    const raw = { host: "h", password: ref("p"), nested: { token: ref("t") } };
    const validated = {
      host: "h",
      port: 5432,
      password: "plain",
      nested: { token: "plain-token" },
    };
    expect(restoreReferences(validated, raw)).toEqual({
      host: "h",
      port: 5432,
      password: ref("p"),
      nested: { token: ref("t") },
    });
  });

  test("restoring never stores a resolved credential", () => {
    const stored = JSON.stringify(
      restoreReferences({ password: "hunter2" }, { password: ref("p") }),
    );
    expect(stored).not.toContain("hunter2");
  });
});
