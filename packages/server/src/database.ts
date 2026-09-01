import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { EncryptedValue } from "./crypto";
import { Database } from "./sqlite-driver";

export type UiServiceRow = {
  id: string;
  name: string;
  adapter: string;
  connection_ciphertext: string;
  connection_iv: string;
  connection_tag: string;
  /** Validated, non-secret settings used only by the built-in Mock Service. */
  mock_settings: string | null;
  created_at: string;
  updated_at: string;
};
export type AuditEvent = {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  metadata: string;
};
export type LocalUser = {
  id: string;
  email: string;
  password_hash: string;
  role: string;
};
export type EnterpriseRole = "owner" | "admin" | "operator" | "viewer";
export type EnterpriseSsoProviderRow = {
  id: string;
  provider_id: string;
  domain: string;
  protocol: "oidc" | "saml";
  config_ciphertext: string;
  config_iv: string;
  config_tag: string;
  created_at: string;
  updated_at: string;
};

const migrations = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ui_services (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, adapter TEXT NOT NULL,
     connection_ciphertext TEXT NOT NULL, connection_iv TEXT NOT NULL, connection_tag TEXT NOT NULL,
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS audit_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL,
     action TEXT NOT NULL, target TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
   );
   CREATE TABLE IF NOT EXISTS local_users (
     id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
     role TEXT NOT NULL, created_at TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS local_sessions (
     token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL,
     FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE
   );`,
  // Better Auth core tables. Enterprise provider configuration deliberately
  // lives in enterprise_sso_providers below, not Better Auth's plaintext
  // ssoProvider model.
  `CREATE TABLE IF NOT EXISTS "user" (
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
   );`,
  `ALTER TABLE ui_services ADD COLUMN mock_settings TEXT;`,
];

export class DsuiDatabase {
  readonly sqlite: Database;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path, { create: true });
    this.sqlite.exec(
      "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;",
    );
    this.sqlite.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
    );
    this.migrate();
  }

  private migrate(): void {
    migrations.forEach((sql, index) => {
      const version = index + 1;
      if (
        !this.sqlite
          .query<{ version: number }, [number]>(
            "SELECT version FROM schema_migrations WHERE version = ?",
          )
          .get(version)
      ) {
        this.sqlite.transaction(() => {
          this.sqlite.exec(sql);
          this.sqlite
            .query(
              "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
            )
            .run(version, new Date().toISOString());
        })();
      }
    });
  }

  listUiServices(): UiServiceRow[] {
    return this.sqlite
      .query<UiServiceRow, []>(
        "SELECT * FROM ui_services ORDER BY created_at ASC",
      )
      .all();
  }
  getUiService(id: string): UiServiceRow | null {
    return (
      this.sqlite
        .query<UiServiceRow, [string]>("SELECT * FROM ui_services WHERE id = ?")
        .get(id) ?? null
    );
  }
  insertUiService(
    service: Pick<UiServiceRow, "id" | "name" | "adapter">,
    encrypted: EncryptedValue,
  ): void {
    const now = new Date().toISOString();
    this.sqlite
      .query(
        "INSERT INTO ui_services (id, name, adapter, connection_ciphertext, connection_iv, connection_tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        service.id,
        service.name,
        service.adapter,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        now,
        now,
      );
  }
  insertMockService(
    service: Pick<UiServiceRow, "id" | "name" | "adapter">,
    settings: Record<string, unknown>,
  ): void {
    if (service.adapter !== "mock")
      throw new Error("Plain mock settings are restricted to Mock Service");
    const now = new Date().toISOString();
    this.sqlite
      .query(
        "INSERT INTO ui_services (id, name, adapter, connection_ciphertext, connection_iv, connection_tag, created_at, updated_at, mock_settings) VALUES (?, ?, ?, '', '', '', ?, ?, ?)",
      )
      .run(
        service.id,
        service.name,
        service.adapter,
        now,
        now,
        JSON.stringify(settings),
      );
  }
  audit(
    actor: string,
    action: string,
    target: string,
    metadata: Record<string, unknown> = {},
  ): void {
    this.sqlite
      .query(
        "INSERT INTO audit_events (at, actor, action, target, metadata) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        new Date().toISOString(),
        actor,
        action,
        target,
        JSON.stringify(metadata),
      );
  }
  hasLocalUsers(): boolean {
    return Boolean(
      this.sqlite
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM local_users",
        )
        .get()?.count,
    );
  }
  createLocalUser(user: LocalUser): void {
    this.sqlite
      .query(
        "INSERT INTO local_users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        user.id,
        user.email.toLowerCase(),
        user.password_hash,
        user.role,
        new Date().toISOString(),
      );
  }
  getLocalUser(email: string): LocalUser | null {
    return (
      this.sqlite
        .query<LocalUser, [string]>(
          "SELECT id, email, password_hash, role FROM local_users WHERE email = ?",
        )
        .get(email.toLowerCase()) ?? null
    );
  }
  createSession(tokenHash: string, userId: string, expiresAt: string): void {
    this.sqlite
      .query(
        "INSERT INTO local_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      )
      .run(tokenHash, userId, expiresAt);
  }
  getSessionPrincipal(tokenHash: string): { id: string; role: string } | null {
    return (
      this.sqlite
        .query<{ id: string; role: string }, [string, string]>(
          "SELECT local_users.id, local_users.role FROM local_sessions JOIN local_users ON local_users.id = local_sessions.user_id WHERE token_hash = ? AND expires_at > ?",
        )
        .get(tokenHash, new Date().toISOString()) ?? null
    );
  }
  deleteSession(tokenHash: string): void {
    this.sqlite
      .query("DELETE FROM local_sessions WHERE token_hash = ?")
      .run(tokenHash);
  }
  getEnterpriseRole(userId: string): EnterpriseRole | null {
    return (
      this.sqlite
        .query<{ role: EnterpriseRole }, [string]>(
          "SELECT role FROM enterprise_memberships WHERE user_id = ?",
        )
        .get(userId)?.role ?? null
    );
  }
  ensureEnterpriseMember(
    userId: string,
    role: EnterpriseRole = "viewer",
  ): void {
    const now = new Date().toISOString();
    this.sqlite
      .query(
        "INSERT INTO enterprise_memberships (user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING",
      )
      .run(userId, role, now, now);
  }
  setEnterpriseRole(userId: string, role: EnterpriseRole): void {
    const now = new Date().toISOString();
    this.sqlite
      .query(
        "INSERT INTO enterprise_memberships (user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at",
      )
      .run(userId, role, now, now);
  }
  listEnterpriseSsoProviders(): EnterpriseSsoProviderRow[] {
    return this.sqlite
      .query<EnterpriseSsoProviderRow, []>(
        "SELECT * FROM enterprise_sso_providers ORDER BY created_at ASC",
      )
      .all();
  }
  upsertEnterpriseSsoProvider(
    provider: Pick<
      EnterpriseSsoProviderRow,
      "id" | "provider_id" | "domain" | "protocol"
    >,
    encrypted: EncryptedValue,
  ): void {
    const now = new Date().toISOString();
    this.sqlite
      .query(
        "INSERT INTO enterprise_sso_providers (id, provider_id, domain, protocol, config_ciphertext, config_iv, config_tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider_id) DO UPDATE SET domain = excluded.domain, protocol = excluded.protocol, config_ciphertext = excluded.config_ciphertext, config_iv = excluded.config_iv, config_tag = excluded.config_tag, updated_at = excluded.updated_at",
      )
      .run(
        provider.id,
        provider.provider_id,
        provider.domain,
        provider.protocol,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        now,
        now,
      );
  }
  close(): void {
    this.sqlite.close();
  }
}
