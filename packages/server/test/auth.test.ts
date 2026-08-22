import { Buffer } from "node:buffer";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/app";
import { ConnectionCipher } from "../src/crypto";
import { DsuiDatabase } from "../src/database";

const masterKey = Buffer.alloc(32, 9).toString("base64");
const authSecret = "7sui-enterprise-secret-with-at-least-32-chars";

describe("enterprise authentication", () => {
  it("rejects spoofed identity headers", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "enterprise",
      masterKey,
      enterpriseAuthUrl: "https://dsui.test",
      enterpriseAuthSecret: authSecret,
    });
    try {
      const response = await runtime.app.request(
        "https://dsui.test/api/v1/auth/me",
        {
          headers: {
            "x-dsui-subject": "attacker",
            "x-dsui-role": "owner",
          },
        },
      );
      expect(response.status).toBe(401);
    } finally {
      runtime.close();
    }
  });

  it("mounts Better Auth's Fetch handler at /api/auth", async () => {
    const runtime = createRuntime({
      databasePath: ":memory:",
      authMode: "enterprise",
      masterKey,
      enterpriseAuthUrl: "https://dsui.test",
      enterpriseAuthSecret: authSecret,
    });
    try {
      const response = await runtime.app.request(
        "https://dsui.test/api/auth/get-session",
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    } finally {
      runtime.close();
    }
  });

  it("loads encrypted OIDC provider configuration into Better Auth", async () => {
    const databasePath = join(
      mkdtempSync(join(tmpdir(), "dsui-auth-")),
      "db.sqlite",
    );
    const database = new DsuiDatabase(databasePath);
    const cipher = new ConnectionCipher(masterKey);
    const secret = "client-secret-that-must-not-be-written-in-plaintext";
    let runtime: ReturnType<typeof createRuntime> | undefined;
    try {
      database.upsertEnterpriseSsoProvider(
        {
          id: "provider-1",
          provider_id: "acme-oidc",
          domain: "acme.test",
          protocol: "oidc",
        },
        cipher.encrypt({
          issuer: "https://idp.acme.test",
          clientId: "dsui",
          clientSecret: secret,
          discoveryEndpoint:
            "https://idp.acme.test/.well-known/openid-configuration",
          authorizationEndpoint: "https://idp.acme.test/authorize",
          tokenEndpoint: "https://idp.acme.test/token",
          jwksEndpoint: "https://idp.acme.test/jwks",
          pkce: true,
        }),
      );
      const stored = database.sqlite
        .query<{ config_ciphertext: string }, []>(
          "SELECT config_ciphertext FROM enterprise_sso_providers",
        )
        .get();
      expect(stored?.config_ciphertext).not.toContain(secret);
      expect(database.listEnterpriseSsoProviders()).toHaveLength(1);
      database.close();
      runtime = createRuntime({
        databasePath,
        authMode: "enterprise",
        masterKey,
        enterpriseAuthUrl: "https://dsui.test",
        enterpriseAuthSecret: authSecret,
      });
      const response = await runtime.app.request(
        "https://dsui.test/api/auth/sign-in/sso",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://dsui.test",
          },
          body: JSON.stringify({
            providerId: "acme-oidc",
            callbackURL: "https://dsui.test/",
          }),
        },
      );
      expect(response.status).toBe(200);
      expect((await response.json()).url).toContain("https://idp.acme.test");
    } finally {
      runtime?.close();
      if (!runtime) database.close();
    }
  });

  it("requires the master key, URL, and signing secret", () => {
    expect(() =>
      createRuntime({
        databasePath: ":memory:",
        authMode: "enterprise",
        enterpriseAuthUrl: "https://dsui.test",
        enterpriseAuthSecret: authSecret,
      }),
    ).toThrow("DSUI_MASTER_KEY");
    expect(() =>
      createRuntime({
        databasePath: ":memory:",
        authMode: "enterprise",
        masterKey,
        enterpriseAuthSecret: authSecret,
      }),
    ).toThrow("DSUI_AUTH_URL");
  });
});
