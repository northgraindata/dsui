import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { StorePersistenceRequest } from "@northgraindata/dsui-adapter-sdk";
import {
  assertValidRunTransition,
  type Run,
  type RunArtifact,
  type RunEvent,
  type RunEventPage,
  type RunRequest,
  type RunState,
} from "../runs/contracts";
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

export type PersistedStoreState = {
  readonly value: unknown;
  readonly version: number;
};

export type StartIdempotencyClaim =
  | { readonly outcome: "claimed"; readonly run: Run }
  | { readonly outcome: "conflict"; readonly reason: "idempotency_key_reused" }
  | {
      readonly outcome: "existing";
      readonly requestFingerprint: string;
      readonly run: Run;
    };

export type CancellationIdempotencyClaim = "claimed" | "existing";

type RunRow = {
  invocation_id: string;
  provider_run_id: string | null;
  request_json: string;
  state: RunState;
  provider_status_json: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  trigger: string | null;
  environment: string | null;
  cancellable: number;
  retryable: number;
  retried_from_invocation_id: string | null;
};

const runInsertSql = `INSERT INTO runs
  (invocation_id, provider_run_id, request_json, state, provider_status_json,
   created_at, started_at, completed_at, duration_ms, trigger, environment,
   cancellable, retryable, retried_from_invocation_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const runUpdateSql = `UPDATE runs SET provider_run_id = ?, request_json = ?, state = ?,
  provider_status_json = ?, created_at = ?, started_at = ?, completed_at = ?,
  duration_ms = ?, trigger = ?, environment = ?, cancellable = ?, retryable = ?,
  retried_from_invocation_id = ? WHERE invocation_id = ?`;

function safeRequestMetadata(request: Run["request"]): string {
  const environment = request.environment
    ? Object.fromEntries(
        Object.entries(request.environment).map(([key, value]) => [
          key,
          "secretRef" in value ? { secretRef: value.secretRef } : {},
        ]),
      )
    : undefined;
  return JSON.stringify({
    ...request,
    ...(environment ? { environment } : {}),
  });
}

type SqlValue = string | number | null;

function runValues(run: Run): SqlValue[] {
  return [
    run.invocationId,
    run.providerRunId ?? null,
    safeRequestMetadata(run.request),
    run.state,
    run.providerStatus ? JSON.stringify(run.providerStatus) : null,
    run.createdAt,
    run.startedAt ?? null,
    run.completedAt ?? null,
    run.durationMs ?? null,
    run.trigger ?? null,
    run.environment ?? null,
    run.cancellable ? 1 : 0,
    run.retryable ? 1 : 0,
    run.retriedFromInvocationId ?? null,
  ];
}

function decodeRun(row: RunRow): Run {
  return {
    invocationId: row.invocation_id,
    ...(row.provider_run_id ? { providerRunId: row.provider_run_id } : {}),
    request: JSON.parse(row.request_json) as RunRequest,
    state: row.state,
    ...(row.provider_status_json
      ? { providerStatus: JSON.parse(row.provider_status_json) }
      : {}),
    createdAt: row.created_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
    ...(row.trigger ? { trigger: row.trigger } : {}),
    ...(row.environment ? { environment: row.environment } : {}),
    cancellable: Boolean(row.cancellable),
    retryable: Boolean(row.retryable),
    ...(row.retried_from_invocation_id
      ? { retriedFromInvocationId: row.retried_from_invocation_id }
      : {}),
  };
}

function eventState(event: RunEvent): RunState | undefined {
  switch (event.type) {
    case "started":
      return "running";
    case "status":
    case "completed":
      return event.state;
    case "cancelled":
      return "cancelled";
    case "timed_out":
      return "timed_out";
    default:
      return undefined;
  }
}

function parseCursor(cursor: string): number {
  const value = Number(cursor);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid run event cursor: ${cursor}`);
  return value;
}

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

  loadStoreState(
    namespace: string,
    request: StorePersistenceRequest,
  ): PersistedStoreState | null {
    const row = this.sqlite
      .query<
        { value_json: string; version: number },
        [string, string, string, string]
      >(
        "SELECT value_json, version FROM store_state WHERE namespace = ? AND scope = ? AND store_id = ? AND store_key = ?",
      )
      .get(namespace, request.scope, request.storeId, request.key);
    if (!row) return null;
    try {
      return { value: JSON.parse(row.value_json), version: row.version };
    } catch {
      throw new Error(
        `Stored state for store "${request.storeId}" is not valid JSON`,
      );
    }
  }

  saveStoreState(
    namespace: string,
    request: StorePersistenceRequest & { readonly value: unknown },
  ): void {
    const now = new Date().toISOString();
    this.sqlite
      .query(
        `INSERT INTO store_state
          (namespace, scope, store_id, store_key, version, value_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(namespace, scope, store_id, store_key)
         DO UPDATE SET version = excluded.version,
                       value_json = excluded.value_json,
                       updated_at = excluded.updated_at`,
      )
      .run(
        namespace,
        request.scope,
        request.storeId,
        request.key,
        request.version,
        JSON.stringify(request.value),
        now,
      );
  }

  claimStartIdempotency(
    idempotencyKey: string,
    requestFingerprint: string,
    run: Run,
  ): StartIdempotencyClaim {
    const claim = this.sqlite.transaction(() => {
      const existing = this.sqlite
        .query<
          { request_fingerprint: string; invocation_id: string },
          [string]
        >(
          "SELECT request_fingerprint, invocation_id FROM run_idempotency WHERE idempotency_key = ?",
        )
        .get(idempotencyKey);
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) {
          return {
            outcome: "conflict" as const,
            reason: "idempotency_key_reused" as const,
          };
        }
        const existingRun = this.loadRun(existing.invocation_id);
        if (!existingRun) throw new Error("Idempotency record has no run");
        return {
          outcome: "existing" as const,
          requestFingerprint: existing.request_fingerprint,
          run: existingRun,
        };
      }
      this.insertRun(run);
      this.sqlite
        .query(
          "INSERT INTO run_idempotency (idempotency_key, request_fingerprint, invocation_id, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(
          idempotencyKey,
          requestFingerprint,
          run.invocationId,
          run.createdAt,
        );
      return { outcome: "claimed" as const, run };
    });
    return claim();
  }

  claimCancellationIdempotency(
    invocationId: string,
    idempotencyKey: string,
  ): CancellationIdempotencyClaim {
    const claim = this.sqlite.transaction(() => {
      const existing = this.sqlite
        .query<unknown, [string, string]>(
          "SELECT 1 FROM run_cancellation_idempotency WHERE invocation_id = ? AND idempotency_key = ?",
        )
        .get(invocationId, idempotencyKey);
      if (existing) return "existing" as const;
      this.sqlite
        .query(
          "INSERT INTO run_cancellation_idempotency (invocation_id, idempotency_key, created_at) VALUES (?, ?, ?)",
        )
        .run(invocationId, idempotencyKey, new Date().toISOString());
      return "claimed" as const;
    });
    return claim();
  }

  recoverInterruptedRuns(): void {
    const now = new Date().toISOString();
    const recover = this.sqlite.transaction(() => {
      const runs = this.sqlite
        .query<{ invocation_id: string; created_at: string }, []>(
          "SELECT invocation_id, created_at FROM runs WHERE state IN ('queued', 'running')",
        )
        .all();
      for (const run of runs) {
        this.sqlite
          .query(
            "UPDATE runs SET state = 'failed', completed_at = ?, duration_ms = ?, cancellable = 0, retryable = 1 WHERE invocation_id = ?",
          )
          .run(
            now,
            Math.max(0, Date.parse(now) - Date.parse(run.created_at)),
            run.invocation_id,
          );
        this.sqlite
          .query(
            "INSERT INTO run_events (invocation_id, sequence, event_json, at, type) VALUES (?, COALESCE((SELECT MAX(sequence) + 1 FROM run_events WHERE invocation_id = ?), 1), ?, ?, 'error')",
          )
          .run(
            run.invocation_id,
            run.invocation_id,
            JSON.stringify({
              type: "error",
              at: now,
              message:
                "Run interrupted before the server restarted; execution was not resumed",
            }),
            now,
          );
      }
    });
    recover();
  }

  loadRun(invocationId: string): Run | null {
    const row = this.sqlite
      .query<RunRow, [string]>("SELECT * FROM runs WHERE invocation_id = ?")
      .get(invocationId);
    return row ? decodeRun(row) : null;
  }

  saveRun(run: Run): void {
    const existing = this.loadRun(run.invocationId);
    if (existing) assertValidRunTransition(existing.state, run.state);
    if (existing) {
      this.updateRun(run);
    } else {
      this.insertRun(run);
    }
  }

  appendRunEvent(invocationId: string, event: RunEvent): number {
    const append = this.sqlite.transaction(() => {
      const run = this.loadRun(invocationId);
      if (!run) throw new Error(`Run not found: ${invocationId}`);
      const nextState = eventState(event);
      if (nextState) {
        assertValidRunTransition(run.state, nextState);
        this.updateRun({ ...run, state: nextState });
      }
      const sequence =
        (this.sqlite
          .query<{ sequence: number }, [string]>(
            "SELECT COALESCE(MAX(sequence), 0) AS sequence FROM run_events WHERE invocation_id = ?",
          )
          .get(invocationId)?.sequence ?? 0) + 1;
      this.sqlite
        .query(
          "INSERT INTO run_events (invocation_id, sequence, event_json, at, type) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          invocationId,
          sequence,
          JSON.stringify(event),
          event.at,
          event.type,
        );
      if (event.type === "artifact_discovered")
        this.saveRunArtifact(event.artifact);
      return sequence;
    });
    return append();
  }

  listRunEvents(
    invocationId: string,
    cursor?: string,
    limit = 100,
  ): RunEventPage {
    const after = cursor ? parseCursor(cursor) : 0;
    const rows = this.sqlite
      .query<
        { sequence: number; event_json: string },
        [string, number, number]
      >(
        "SELECT sequence, event_json FROM run_events WHERE invocation_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?",
      )
      .all(invocationId, after, limit + 1);
    const page = rows
      .slice(0, limit)
      .map((row) => JSON.parse(row.event_json) as RunEvent);
    return {
      events: page,
      ...(rows.length > limit
        ? { nextCursor: String(rows[limit - 1].sequence) }
        : {}),
    };
  }

  listRunArtifacts(invocationId: string): readonly RunArtifact[] {
    return this.sqlite
      .query<{ artifact_json: string }, [string]>(
        "SELECT artifact_json FROM run_artifacts WHERE invocation_id = ? ORDER BY created_at ASC, artifact_id ASC",
      )
      .all(invocationId)
      .map((row) => JSON.parse(row.artifact_json) as RunArtifact);
  }

  getRunArtifact(invocationId: string, artifactId: string): RunArtifact | null {
    const row = this.sqlite
      .query<{ artifact_json: string }, [string, string]>(
        "SELECT artifact_json FROM run_artifacts WHERE invocation_id = ? AND artifact_id = ?",
      )
      .get(invocationId, artifactId);
    return row ? (JSON.parse(row.artifact_json) as RunArtifact) : null;
  }

  private insertRun(run: Run): void {
    this.sqlite.query(runInsertSql).run(...runValues(run));
  }

  private updateRun(run: Run): void {
    this.sqlite
      .query(runUpdateSql)
      .run(...runValues(run).slice(1), run.invocationId);
  }

  private saveRunArtifact(artifact: RunArtifact): void {
    this.sqlite
      .query(
        "INSERT INTO run_artifacts (invocation_id, artifact_id, artifact_json, kind, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(invocation_id, artifact_id) DO UPDATE SET artifact_json = excluded.artifact_json, kind = excluded.kind, content_type = excluded.content_type",
      )
      .run(
        artifact.invocationId,
        artifact.artifactId,
        JSON.stringify(artifact),
        artifact.kind,
        artifact.contentType,
        artifact.generatedAt ?? new Date().toISOString(),
      );
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
