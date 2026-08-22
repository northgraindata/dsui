/** Deliberately small external-adapter JSON-RPC runner. It is not a sandbox. */
import { pathToFileURL } from "node:url";

type Request = { jsonrpc: "2.0"; id: string | number; method: string; params: { connection: Record<string, unknown>; input?: unknown } };

function argument(name: string): string | undefined {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function reply(id: string | number | null, result?: unknown, message?: string): void {
  process.stdout.write(`${JSON.stringify(message ? { jsonrpc: "2.0", id, error: { code: -32000, message } } : { jsonrpc: "2.0", id, result })}\n`);
}

export async function runExternalHost(): Promise<number> {
  const bundle = argument("--bundle");
  if (!bundle) { process.stderr.write("external-host requires --bundle <absolute-mjs-path>\n"); return 2; }
  let definition: any;
  try {
    const module = await import(pathToFileURL(bundle).href);
    definition = module.default ?? module.adapter;
    if (!definition?.connectionSchema?.parse || typeof definition.create !== "function") throw new Error("bundle does not export an adapter definition");
  } catch (error) { process.stderr.write(`Could not load adapter: ${error instanceof Error ? error.message : "invalid bundle"}\n`); return 1; }
  const input = await new Response(Bun.stdin.stream()).text();
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let request: Request;
    try { request = JSON.parse(line); if (request.jsonrpc !== "2.0" || !request.params || typeof request.method !== "string") throw new Error("invalid request"); }
    catch { reply(null, undefined, "invalid JSON-RPC request"); continue; }
    try {
      const connection = definition.connectionSchema.parse(request.params.connection);
      const instance = definition.create({}, connection);
      const result = request.method === "health" ? await instance.health() : await instance.execute(request.method, request.params.input ?? {});
      await instance.close?.();
      reply(request.id, result);
    } catch (error) { reply(request.id, undefined, error instanceof Error ? error.message : "adapter host failed"); }
  }
  return 0;
}

if (import.meta.main) process.exit(await runExternalHost());
