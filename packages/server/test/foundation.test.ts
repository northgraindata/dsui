import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { interpolateEnvironment } from "../src/config";
import { ConnectionCipher } from "../src/db/crypto";

describe("foundation utilities", () => {
  it("interpolates required environment variables", () => {
    expect(
      interpolateEnvironment("http://$" + "{HOST}:$" + "{PORT}", {
        HOST: "db",
        PORT: "5432",
      }),
    ).toBe("http://db:5432");
    expect(() => interpolateEnvironment("$" + "{MISSING}", {})).toThrow(
      "MISSING",
    );
  });

  it("encrypts persisted connections with authenticated encryption", () => {
    const cipher = new ConnectionCipher(Buffer.alloc(32, 1).toString("base64"));
    const encrypted = cipher.encrypt({ password: "not-in-plaintext" });
    expect(encrypted.ciphertext).not.toContain("not-in-plaintext");
    expect(cipher.decrypt<Record<string, unknown>>(encrypted)).toEqual({
      password: "not-in-plaintext",
    });
  });
});
