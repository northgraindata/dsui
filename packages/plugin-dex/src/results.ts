/**
 * The latest result of each view, per project.
 *
 * Pages and the AI agent read these, so reading never starts Dex. A failed
 * refresh keeps the previous content and records why it failed.
 */
import type { PluginStorage } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { database } from "./database.js";
import type { ViewContent, ViewKind } from "./views.js";

const rowSchema = z.record(z.union([z.string(), z.number(), z.null()]));

const contentSchema: z.ZodType<ViewContent> = z.discriminatedUnion("format", [
  z.object({ format: z.literal("rows"), rows: z.array(rowSchema) }),
  z.object({ format: z.literal("mermaid"), mermaid: z.string() }),
  z.object({ format: z.literal("unrecognized") }),
]);

const recordSchema = z.object({
  state: z.string(),
  message: z.string(),
  checked_at: z.string(),
  content: z.string().nullable(),
  content_at: z.string().nullable(),
});

export type ViewState =
  | "never-run"
  | "ok"
  | "unrecognized"
  | "needs-confirmation"
  | "error";

const stateSchema: z.ZodType<ViewState> = z.enum([
  "never-run",
  "ok",
  "unrecognized",
  "needs-confirmation",
  "error",
]);

export type ViewResult = {
  readonly state: ViewState;
  readonly message: string;
  readonly checkedAt: string | null;
  /** When `content` was read; older than `checkedAt` after a failed refresh. */
  readonly contentAt: string | null;
  readonly content: ViewContent | null;
};

export function readResult(
  storage: PluginStorage,
  projectId: string,
  kind: ViewKind,
): ViewResult {
  const row = database(storage)
    .query(
      "SELECT state, message, checked_at, content, content_at FROM view_results WHERE project_id = ? AND kind = ?",
    )
    .get(projectId, kind);
  if (!row)
    return {
      state: "never-run",
      message: "Not refreshed yet",
      checkedAt: null,
      contentAt: null,
      content: null,
    };
  const record = recordSchema.parse(row);
  return {
    state: stateSchema.parse(record.state),
    message: record.message,
    checkedAt: record.checked_at,
    contentAt: record.content_at,
    content: record.content
      ? contentSchema.parse(JSON.parse(record.content))
      : null,
  };
}

export function saveResult(
  storage: PluginStorage,
  projectId: string,
  kind: ViewKind,
  result: { state: ViewState; message: string; content?: ViewContent },
): void {
  const now = new Date().toISOString();
  const content = result.content ? JSON.stringify(result.content) : null;
  database(storage)
    .query(
      `INSERT INTO view_results (project_id, kind, state, message, checked_at, content, content_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (project_id, kind) DO UPDATE SET
         state = excluded.state,
         message = excluded.message,
         checked_at = excluded.checked_at,
         content = COALESCE(excluded.content, view_results.content),
         content_at = COALESCE(excluded.content_at, view_results.content_at)`,
    )
    .run(
      projectId,
      kind,
      result.state,
      result.message,
      now,
      content,
      content ? now : null,
    );
}
