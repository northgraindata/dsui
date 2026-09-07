import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { EncryptedValue } from "./crypto";
import { runMigrations } from "./migrate";
import { migrations } from "./migrations/index";

export type UiServiceRow = {
  id: string;
  name: string;
  adapter: string;
  connection_ciphertext: string;
  connection_iv: string;
  connection_tag: string;
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

export class DsuiDatabase {
  readonly sqlite: Database;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path, { create: true });
    this.sqlite.exec(
      "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;",
    );
    runMigrations(this.sqlite, migrations);
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
  deleteUiService(id: string): void {
    this.sqlite.query("DELETE FROM ui_services WHERE id = ?").run(id);
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
