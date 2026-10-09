import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import type { SignalType } from "@northgraindata/dsui-adapter-sdk";
import type { PluginSignalEvent } from "@northgraindata/dsui-plugin-sdk";
import type { DsuiDatabase } from "../db/database.js";

export type SignalEvent = PluginSignalEvent;

export interface PublishSignalInput {
  readonly signalId: string;
  readonly type: SignalType;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly serviceId?: string;
  readonly payload: unknown;
  readonly origin?: SignalEvent["origin"];
  readonly idempotencyKey?: string;
}

function toEvent(row: Record<string, unknown>): SignalEvent {
  return {
    id: String(row.id),
    signalId: String(row.signal_id),
    type: String(row.type) as SignalType,
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    ...(row.service_id === null ? {} : { serviceId: String(row.service_id) }),
    payload: JSON.parse(String(row.payload_json)),
    ...(row.origin_json ? { origin: JSON.parse(String(row.origin_json)) } : {}),
    occurredAt: String(row.occurred_at),
  };
}

/** Durable append-only event log with in-process subscribers. */
export class SignalBus {
  private readonly listeners = new Set<(event: SignalEvent) => void>();

  constructor(private readonly database: DsuiDatabase) {}

  private get db(): Database {
    return this.database.sqlite;
  }

  publish(input: PublishSignalInput): SignalEvent {
    const occurredAt = new Date().toISOString();
    const id = randomUUID();
    const payloadJson = JSON.stringify(input.payload ?? null);
    this.db
      .query(
        `INSERT INTO events
           (id, signal_id, type, source_type, source_id, service_id, payload_json,
            idempotency_key, occurred_at, origin_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .run(
        id,
        input.signalId,
        input.type,
        input.sourceType,
        input.sourceId,
        input.serviceId ?? null,
        payloadJson,
        input.idempotencyKey ?? null,
        occurredAt,
        input.origin ? JSON.stringify(input.origin) : null,
      );
    const row = input.idempotencyKey
      ? (this.db
          .query(
            `SELECT id, signal_id, type, source_type, source_id, service_id,
                    payload_json, occurred_at, origin_json
               FROM events
              WHERE source_type = ? AND source_id = ? AND signal_id = ?
                AND idempotency_key = ?`,
          )
          .get(
            input.sourceType,
            input.sourceId,
            input.signalId,
            input.idempotencyKey,
          ) as Record<string, unknown> | undefined)
      : (this.db
          .query(
            `SELECT id, signal_id, type, source_type, source_id, service_id,
                    payload_json, occurred_at, origin_json
               FROM events WHERE id = ?`,
          )
          .get(id) as Record<string, unknown> | undefined);
    if (!row) throw new Error("Signal event could not be persisted");
    const event = toEvent(row);
    if (event.id !== id) {
      if (
        event.type !== input.type ||
        JSON.stringify(event.payload) !== payloadJson ||
        event.serviceId !== input.serviceId
      )
        throw new Error(
          "Signal idempotency key was reused with different data",
        );
      return event;
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Signal event subscriber failed", error);
      }
    }
    return event;
  }

  list(
    options: {
      readonly after?: string;
      readonly serviceId?: string;
      readonly signalId?: string;
      readonly limit?: number;
    } = {},
  ): SignalEvent[] {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (options.after) {
      clauses.push("occurred_at > ?");
      values.push(options.after);
    }
    if (options.serviceId) {
      clauses.push("service_id = ?");
      values.push(options.serviceId);
    }
    if (options.signalId) {
      clauses.push("signal_id = ?");
      values.push(options.signalId);
    }
    values.push(Math.min(Math.max(options.limit ?? 100, 1), 500));
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return (
      this.db
        .query(
          `SELECT id, signal_id, type, source_type, source_id, service_id,
                  payload_json, occurred_at, origin_json
             FROM events ${where}
            ORDER BY occurred_at DESC, id DESC LIMIT ?`,
        )
        .all(...(values as never[])) as unknown as Record<string, unknown>[]
    ).map(toEvent);
  }

  /** A persisted sequence remains stable across compaction and timestamp ties. */
  read(options: { cursor?: string; limit?: number } = {}) {
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new Error("Event page size must be between 1 and 500");
    if (options.cursor === "latest") {
      const tail = this.db
        .query<{ cursor: number }, []>(
          "SELECT COALESCE(MAX(sequence), 0) AS cursor FROM event_sequence",
        )
        .get();
      return { items: [], cursor: String(tail?.cursor ?? 0), hasMore: false };
    }
    const cursor = options.cursor ?? "0";
    if (!/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))
      throw new Error("Invalid event cursor");
    const rows = this.db
      .query<Record<string, unknown>, [number, number]>(
        "SELECT s.sequence, e.* FROM event_sequence s JOIN events e ON e.id=s.event_id WHERE s.sequence > ? ORDER BY s.sequence LIMIT ?",
      )
      .all(Number(cursor), limit + 1);
    const page = rows.slice(0, limit);
    return {
      items: page.map(toEvent),
      cursor: page.length ? String(page.at(-1)?.sequence) : cursor,
      hasMore: rows.length > limit,
    };
  }

  subscribe(listener: (event: SignalEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
