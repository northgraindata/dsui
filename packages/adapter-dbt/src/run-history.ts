import { createHash } from "node:crypto";
import type { BlobStore } from "@northgraindata/dsui-adapter-sdk";

/** Pushed runs older than this are deleted, so history cannot grow without bound. */
export const RUN_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
/** A pipeline that pushes every minute would still keep only this many. */
export const MAX_KEPT_RUNS = 500;
const PREFIX = "runs/";

export interface RunSummary {
  readonly failed: number;
  readonly id: string;
  /** When dbt wrote the results, from the artifact itself. */
  readonly startedAt: string;
  readonly status: "error" | "success";
  readonly total: number;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * The blob key of a run. dbt's invocation id names it, so pushing the same
 * run twice replaces it; an artifact without one is named by its content.
 * Anything outside the characters a blob key allows is replaced.
 */
export function runKey(data: Record<string, unknown>, text: string): string {
  const invocation = record(data.metadata)?.invocation_id;
  const cleaned =
    typeof invocation === "string"
      ? invocation
          .replace(/[^A-Za-z0-9._-]/g, "-")
          .replace(/^[^A-Za-z0-9]+/, "")
      : "";
  const id =
    cleaned.length > 0 && cleaned.length <= 100 && !cleaned.includes("..")
      ? cleaned
      : createHash("sha256").update(text).digest("hex").slice(0, 32);
  return `${PREFIX}${id}/run_results.json`;
}

const idOfKey = (key: string) => key.slice(PREFIX.length).split("/")[0] ?? key;

/** What one run's `run_results.json` says, in the shape the runs page lists. */
export function summarizeRun(
  id: string,
  data: Record<string, unknown>,
): RunSummary {
  const results = Array.isArray(data.results) ? data.results : [];
  const failed = results.filter((item) => {
    const status = record(item)?.status;
    return (
      typeof status === "string" &&
      ["error", "fail", "failed"].includes(status.toLowerCase())
    );
  }).length;
  const generated = record(data.metadata)?.generated_at;
  return {
    failed,
    id,
    startedAt: typeof generated === "string" ? generated : "",
    status: failed > 0 ? "error" : "success",
    total: results.length,
  };
}

/**
 * Keeps the run and forgets what is too old or beyond the newest
 * {@link MAX_KEPT_RUNS}. Runs on every push, so there is no separate cleanup
 * to forget about.
 */
export async function archiveRun(
  blobs: BlobStore,
  data: Record<string, unknown>,
  bytes: Uint8Array,
  now: Date = new Date(),
): Promise<string> {
  const key = runKey(data, new TextDecoder().decode(bytes));
  await blobs.put(key, bytes);
  const kept = [...(await blobs.list(PREFIX))].sort((left, right) =>
    left.updatedAt < right.updatedAt ? 1 : -1,
  );
  const cutoff = now.getTime() - RUN_RETENTION_MS;
  const expired = kept.filter(
    (blob, index) =>
      index >= MAX_KEPT_RUNS || Date.parse(blob.updatedAt) < cutoff,
  );
  // The run just pushed is never the one that is dropped.
  await Promise.all(
    expired
      .filter((blob) => blob.key !== key)
      .map((blob) => blobs.delete(blob.key)),
  );
  return idOfKey(key);
}

/** The newest runs, newest first. */
export async function listRuns(
  blobs: BlobStore,
  limit = 50,
): Promise<RunSummary[]> {
  const newest = [...(await blobs.list(PREFIX))]
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
    .slice(0, limit);
  const read = await Promise.all(
    newest.map(async (blob) => {
      const bytes = await blobs.get(blob.key);
      if (!bytes) return undefined;
      try {
        const data = record(JSON.parse(new TextDecoder().decode(bytes)));
        return data ? summarizeRun(idOfKey(blob.key), data) : undefined;
      } catch {
        // A file that is not valid JSON is not a run.
        return undefined;
      }
    }),
  );
  return read
    .filter((run): run is RunSummary => run !== undefined)
    .sort((left, right) => (left.startedAt < right.startedAt ? 1 : -1));
}

/** One run's results, or undefined when it is unknown or already forgotten. */
export async function readRun(
  blobs: BlobStore,
  id: string,
): Promise<Record<string, unknown> | undefined> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.includes("..")) {
    return undefined;
  }
  const bytes = await blobs.get(`${PREFIX}${id}/run_results.json`);
  if (!bytes) return undefined;
  try {
    return record(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return undefined;
  }
}
