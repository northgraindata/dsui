import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";

export const configSchema = z.object({
  githubToken: z.string().min(1).optional(),
  gitlab: z
    .array(
      z.object({
        id: z.string().min(1),
        url: z.string().url(),
        token: z.string().min(1).optional(),
      }),
    )
    .default([{ id: "gitlab", url: "https://gitlab.com" }]),
  localRoots: z.array(z.string().min(1)).default([]),
  maxSnapshotBytes: z
    .number()
    .int()
    .positive()
    .max(256 * 1024 * 1024)
    .default(64 * 1024 * 1024),
  maxFiles: z.number().int().positive().max(50000).default(10000),
});
export type Config = z.infer<typeof configSchema>;
export type Context = PluginContext<Config>;
export const connectionSchema = z.object({
  id: z.string().uuid().optional(),
  serviceId: z.string().min(1),
  name: z.string().trim().max(120).default(""),
  provider: z.enum(["github", "gitlab", "local"]),
  instance: z.string().default("gitlab"),
  repository: z.string().trim().min(1).max(2048),
  branch: z.string().trim().max(256).default(""),
  folder: z.string().max(2048).default(""),
  instructions: z.string().max(50000).default(""),
  refreshMinutes: z.number().int().min(0).max(10080).default(15),
});
export type ConnectionInput = z.infer<typeof connectionSchema>;
export type Connection = ConnectionInput & {
  id: string;
  revision: number;
  status: "idle" | "queued" | "syncing" | "ready" | "error";
  lastAttemptAt: string | null;
  lastFetchedAt: string | null;
  error: string | null;
  version: string | null;
};
export const locatorSchema = z.object({
  serviceId: z.string().min(1),
  connectionId: z.string().uuid(),
});
export const fileRequestSchema = locatorSchema.extend({
  path: z.string().default(""),
});
export type SnapshotFile = { path: string; bytes: Uint8Array; size: number };
export const previewLimit = 1024 * 1024;
export function route(serviceId: string, connectionId?: string, path?: string) {
  const base = `/services/${encodeURIComponent(serviceId)}`;
  if (!connectionId) return base;
  return `${base}/connections/${connectionId}/files/${(path ?? "").split("/").map(encodeURIComponent).join("/")}`;
}

export function connectionName(
  input: Pick<ConnectionInput, "repository" | "folder">,
): string {
  const repository =
    input.repository
      .replace(/\/+$/, "")
      .replace(/\.git$/, "")
      .split("/")
      .at(-1) ?? "Source code";
  return (input.folder ? `${repository} / ${input.folder}` : repository).slice(
    0,
    120,
  );
}
