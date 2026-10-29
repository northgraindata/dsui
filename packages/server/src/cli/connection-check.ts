import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { loadAdapter } from "../adapters/loader";
import type { AdapterBackend } from "../adapters/types";
import { gitAdapterSourceSchema, toAdapterSourceLocation } from "../config";

export const connectionCheckSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  source: gitAdapterSourceSchema,
  connection: z.record(z.unknown()),
  resources: z.array(z.string().min(1).max(100)).max(10).default([]),
});

/** Uses the adapter's actual connection validation, health probe and read resources. */
export async function inspectConnection(
  backend: Pick<
    AdapterBackend,
    "validateConnection" | "checkHealth" | "executeResource"
  >,
  raw: unknown,
  resources: readonly string[],
  available: readonly string[],
) {
  const connection = backend.validateConnection(raw);
  const started = performance.now();
  const health = await backend.checkHealth(connection);
  if (health.status !== "healthy")
    throw new Error(
      "Could not connect. Check the host, network access and credentials.",
    );
  const latencyMs = health.latencyMs ?? Math.round(performance.now() - started);
  const metadata: Record<string, unknown> = {};
  for (const id of resources.filter((candidate) =>
    available.includes(candidate),
  )) {
    try {
      metadata[id] = (await backend.executeResource(id, connection, {})).data;
    } catch {
      // A successful health check is not evidence that every metadata permission is granted.
      metadata[id] = { unavailable: true };
    }
  }
  return { latencyMs, metadata };
}

/** Input travels over stdin, so connection credentials never enter argv or config files. */
export async function connectionCheck(dataDir: string): Promise<number> {
  let backend: AdapterBackend | undefined;
  try {
    const input = connectionCheckSchema.parse(
      JSON.parse(await Bun.stdin.text()),
    );
    await mkdir(dataDir, { recursive: true });
    const marker = join(dataDir, "source.json");
    const signature = JSON.stringify(input.source);
    let cached = false;
    try {
      cached =
        (await readFile(marker, "utf8")) === signature &&
        existsSync(
          join(
            dataDir,
            "adapters",
            "build",
            input.id,
            "src",
            "dist",
            "adapter.mjs",
          ),
        );
    } catch {
      /* First check builds the adapter. */
    }
    const adapter = await loadAdapter(
      input.id,
      toAdapterSourceLocation(input.source, process.cwd()),
      {
        dataDir,
        offline: cached,
      },
    );
    backend = adapter.backend;
    if (!cached) await writeFile(marker, signature);
    const result = await inspectConnection(
      backend,
      input.connection,
      input.resources,
      adapter.catalog.resources.map((resource) => resource.id),
    );
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
    return 0;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "The connection details do not match the adapter's connection schema."
        : "Could not connect or read the adapter. Check the host, network access, credentials and metadata permissions.";
    // Adapter errors may include credential-bearing URLs; only safe messages cross the boundary.
    process.stdout.write(`${JSON.stringify({ ok: false, message })}\n`);
    return 1;
  } finally {
    await backend?.close?.();
  }
}
