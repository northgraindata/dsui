import { randomUUID } from "node:crypto";
import { HostSession } from "./host-session";
import { SessionPool } from "./sessions";

/**
 * Transport to an `adapter-host` subprocess. One request per process:
 * the host reads a single JSON-RPC message on stdin, prints one line on
 * stdout, and exits on EOF. Stateless by construction — no cross-request
 * state can leak between calls.
 */

export type HostMethod = "describe" | "health" | "page" | "resource" | "action";

export interface AdapterHostRequest {
  id?: string | number;
  method: HostMethod;
  /** Decrypted connection object (host is same-trust-domain). */
  connection?: unknown;
  /** Resource or action id for `resource`/`action` methods. */
  target?: string;
  input?: unknown;
  sessionId?: string;
}

interface JsonRpcResponse {
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: { message?: unknown };
}

export interface AdapterHostClientOptions {
  command: string;
  args?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export class AdapterHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterHostError";
  }
}

async function readStreamLimited(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  label: string,
): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > limit)
        throw new AdapterHostError(`${label} exceeds output limit`);
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export class AdapterHostClient {
  private readonly sessions;
  constructor(private readonly options: AdapterHostClientOptions) {
    this.sessions = new SessionPool(
      async () => new HostSession(options),
      (session) => session.dispose(),
    );
  }

  closeSession(id: string) {
    return this.sessions.close(id);
  }
  dispose() {
    return this.sessions.dispose();
  }

  async request(
    request: AdapterHostRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (request.sessionId) {
      const result = await this.sessions.run(
        request.sessionId,
        request.connection,
        (session) => session.request(request, signal),
      );
      if (
        result &&
        typeof result === "object" &&
        "sessionError" in result &&
        typeof result.sessionError === "string"
      )
        throw new AdapterHostError(result.sessionError);
      return result;
    }
    const max = this.options.maxOutputBytes ?? 256 * 1024;
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const input = `${JSON.stringify({
      jsonrpc: "2.0",
      id: request.id ?? randomUUID(),
      method: request.method,
      params: {
        connection: request.connection ?? {},
        target: request.target,
        input: request.input ?? {},
      },
    })}\n`;
    if (Buffer.byteLength(input) > max)
      throw new AdapterHostError("Host request exceeds output limit");
    const child = Bun.spawn(
      [this.options.command, ...(this.options.args ?? [])],
      { stdin: new Blob([input]).stream(), stdout: "pipe", stderr: "pipe" },
    );
    const timer = {
      value: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    const timed = new Promise<never>((_, reject) => {
      timer.value = setTimeout(() => {
        child.kill();
        reject(new AdapterHostError("Adapter host timed out"));
      }, timeoutMs);
    });
    try {
      const [stdout, stderr, code] = await Promise.race([
        Promise.all([
          readStreamLimited(child.stdout, max, "Adapter host stdout"),
          readStreamLimited(child.stderr, max, "Adapter host stderr"),
          child.exited,
        ]),
        timed,
      ]);
      if (code !== 0)
        throw new AdapterHostError(
          `Adapter host exited with ${code}${stderr ? `: ${stderr.slice(0, 512)}` : ""}`,
        );
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      if (lines.length !== 1)
        throw new AdapterHostError(
          "Adapter host returned an invalid JSON-RPC response",
        );
      let response: JsonRpcResponse;
      try {
        response = JSON.parse(lines[0]);
      } catch {
        throw new AdapterHostError(
          "Adapter host returned an invalid JSON-RPC response",
        );
      }
      if (response.error)
        throw new AdapterHostError(
          typeof response.error.message === "string"
            ? response.error.message
            : "Adapter host failed",
        );
      return response.result;
    } finally {
      clearTimeout(timer.value);
      child.kill();
    }
  }
}
