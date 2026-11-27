import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import {
  type OutputCommand,
  outputSummarySchema,
  runOutputSchema,
} from "./contract.js";
import { database } from "./database.js";
import type { DexEnvelope } from "./envelope.js";
import { redactPaths } from "./messages.js";

const MAX_BYTES = 256 * 1024;
const privateKey =
  /^(?:connection|credentials?|password|passwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|dsn|connection[_-]?string)$/i;

function redact(value: unknown, paths: readonly string[]): unknown {
  if (typeof value === "string")
    return redactPaths(value, paths).replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi,
      "$1<redacted>@",
    );
  if (Array.isArray(value)) return value.map((item) => redact(item, paths));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateKey.test(key))
        .map(([key, item]) => [redactPaths(key, paths), redact(item, paths)]),
    );
  return value;
}

export function saveOutput(
  storage: PluginStorage,
  runId: string,
  command: OutputCommand,
  result:
    | { envelope: DexEnvelope; paths: readonly string[] }
    | { message: string },
) {
  const json =
    "envelope" in result
      ? JSON.stringify(redact(result.envelope, result.paths))
      : null;
  const tooLarge = json !== null && Buffer.byteLength(json) > MAX_BYTES;
  const state = tooLarge ? "too-large" : "available";
  const message = tooLarge ? "Response exceeds the 256 KiB limit." : "";
  database(storage)
    .query(`INSERT INTO run_outputs (run_id, command, status, state, message, json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (run_id, command) DO UPDATE SET
      status = excluded.status, state = excluded.state, message = excluded.message, json = excluded.json`)
    .run(
      runId,
      command,
      "envelope" in result ? result.envelope.status : "unavailable",
      json === null ? "unavailable" : state,
      "message" in result ? result.message : message,
      tooLarge ? null : json,
    );
}

export function listOutputs(storage: PluginStorage, runId: string) {
  return database(storage)
    .query(
      "SELECT command, status, state, message FROM run_outputs WHERE run_id = ?",
    )
    .all(runId)
    .map((row) => outputSummarySchema.parse(row));
}

export function readOutput(
  storage: PluginStorage,
  projectId: string,
  runId: string,
  command: OutputCommand,
) {
  const row = database(storage)
    .query(`SELECT o.command, o.status, o.state, o.message, o.json
      FROM run_outputs o JOIN runs r ON r.id = o.run_id
      WHERE r.project_id = ? AND o.run_id = ? AND o.command = ?`)
    .get(projectId, runId, command);
  return row ? runOutputSchema.parse(row) : null;
}
