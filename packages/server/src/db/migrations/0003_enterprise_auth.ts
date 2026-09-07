import type { Database } from "bun:sqlite";
import type { Migration } from "../migrate.js";

export const migration_0003_enterprise_auth: Migration = {
  version: 3,
  name: "enterprise-auth",
  // Better Auth core tables. Enterprise provider configuration deliberately
  // lives in enterprise_sso_providers below, not Better Auth's plaintext
  // ssoProvider model.
  up(db: Database): void {
    db.exec(`CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, ipAddress TEXT,
      userAgent TEXT, userId TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS session_userId_idx ON session(userId);
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY, issuer TEXT NOT NULL, accountId TEXT NOT NULL,
      providerId TEXT NOT NULL, userId TEXT NOT NULL, accessToken TEXT,
      refreshToken TEXT, idToken TEXT, accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT, scope TEXT, password TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      UNIQUE(issuer, accountId),
      FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS account_userId_idx ON account(userId);
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
      expiresAt TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
    CREATE TABLE IF NOT EXISTS enterprise_memberships (
      user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'operator', 'viewer')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS enterprise_sso_providers (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL UNIQUE, domain TEXT NOT NULL,
      protocol TEXT NOT NULL CHECK(protocol IN ('oidc', 'saml')),
      config_ciphertext TEXT NOT NULL, config_iv TEXT NOT NULL, config_tag TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
  },
};
