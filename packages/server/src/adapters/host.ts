import { createHash, randomUUID } from "node:crypto";

export type HostMethod =
  | "describe"
  | "health"
  | "page"
  | "resource"
  | "action"
  | "job";

export interface AdapterHostRequest {
  id?: string | number;
  method: HostMethod;
  /** Decrypted connection object (host is same-trust-domain). */
  connection?: unknown;
  target?: string;
  input?: unknown;
  /** Stable DSUI service id used to isolate retained contexts and stores. */
  persistenceNamespace?: string;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Parent-only override; long context retention must not be cut short by host idle. */
  hostIdleTimeoutMs?: number;
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
  /** Close an unused process independently of its adapter context. */
  hostIdleTimeoutMs?: number;
  /** Maximum retained processes per adapter; busy overflow calls are ephemeral. */
  maxHosts?: number;
}

export class AdapterHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterHostError";
  }
}

/** One sequential JSON-RPC stream. A failed or cancelled call retires it. */
class HostSession {
  private readonly child;
  private readonly reader;
  private buffered = Buffer.alloc(0);
  private stderr = "";
  private closed = false;

  constructor(private readonly options: AdapterHostClientOptions) {
    this.child = Bun.spawn(
      [options.command, ...(options.args ?? []), "--persistent"],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    this.reader = this.child.stdout.getReader();
    // Continuously drain stderr: a verbose adapter must not block on its pipe.
    void this.drainStderr();
  }

  private async drainStderr(): Promise<void> {
    const reader = this.child.stderr.getReader();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        this.stderr = (
          this.stderr + new TextDecoder().decode(chunk.value)
        ).slice(-512);
      }
    } catch {
      // Killing a failed session can close its pipe while it is being read.
    } finally {
      reader.releaseLock();
    }
  }

  async close(force = false): Promise<void> {
    if (this.closed) return this.child.exited.then(() => undefined);
    this.closed = true;
    this.child.stdin.end();
    if (force) this.child.kill();
    const deadline = setTimeout(() => this.child.kill("SIGKILL"), 1_000);
    deadline.unref();
    try {
      await this.child.exited;
    } finally {
      clearTimeout(deadline);
    }
  }

  private async readResponse(max: number): Promise<JsonRpcResponse> {
    for (;;) {
      const newline = this.buffered.indexOf(10);
      if (newline !== -1) {
        if (newline > max)
          throw new AdapterHostError(
            "Adapter host stdout exceeds output limit",
          );
        const line = this.buffered.subarray(0, newline).toString("utf8");
        this.buffered = this.buffered.subarray(newline + 1);
        if (this.buffered.length !== 0)
          throw new AdapterHostError(
            "Adapter host returned an unexpected response",
          );
        try {
          const response: unknown = JSON.parse(line);
          if (!response || typeof response !== "object")
            throw new Error("invalid response");
          return response;
        } catch {
          throw new AdapterHostError(
            "Adapter host returned an invalid JSON-RPC response",
          );
        }
      }
      if (this.buffered.length > max)
        throw new AdapterHostError("Adapter host stdout exceeds output limit");
      const next = await this.reader.read();
      if (next.done)
        throw new AdapterHostError(
          `Adapter host exited${this.stderr ? `: ${this.stderr}` : ""}`,
        );
      this.buffered = Buffer.concat([this.buffered, next.value]);
    }
  }

  async request(request: AdapterHostRequest): Promise<unknown> {
    if (this.closed) throw new AdapterHostError("Adapter host closed");
    request.signal?.throwIfAborted();
    const max = this.options.maxOutputBytes ?? 256 * 1024;
    const id = request.id ?? randomUUID();
    const input = `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: request.method,
      params: {
        connection: request.connection ?? {},
        target: request.target,
        input: request.input ?? {},
        persistenceNamespace: request.persistenceNamespace,
        runId: request.runId,
      },
    })}\n`;
    if (Buffer.byteLength(input) > max)
      throw new AdapterHostError("Host request exceeds output limit");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      if (!request.signal) return;
      abortListener = () =>
        reject(
          request.signal?.reason ??
            new AdapterHostError("Adapter host aborted"),
        );
      request.signal.addEventListener("abort", abortListener, { once: true });
      if (request.signal.aborted) abortListener();
    });
    const timed = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new AdapterHostError("Adapter host timed out")),
        request.timeoutMs ?? this.options.timeoutMs ?? 10_000,
      );
    });
    try {
      const exchange = async () => {
        this.child.stdin.write(input);
        await this.child.stdin.flush();
        return this.readResponse(max);
      };
      const response = await Promise.race([exchange(), timed, cancelled]);
      if (response.jsonrpc !== "2.0" || response.id !== id)
        throw new AdapterHostError(
          "Adapter host returned an invalid JSON-RPC response",
        );
      if (response.error)
        throw new AdapterHostError(
          typeof response.error.message === "string"
            ? response.error.message
            : "Adapter host failed",
        );
      return response.result;
    } catch (error) {
      await this.close(true);
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      if (abortListener)
        request.signal?.removeEventListener("abort", abortListener);
    }
  }
}

interface HostSlot {
  tail: Promise<void>;
  pending: number;
  session?: HostSession;
  fingerprint?: string;
  idleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Retains a bounded set of processes, one per service. Calls for one service
 * are queued, so abort/timeout can kill its active process without affecting
 * another call. Unscoped connection tests and describe calls are ephemeral.
 */
export class AdapterHostClient {
  private readonly slots = new Map<string, HostSlot>();
  private closed = false;
  private allocation = Promise.resolve();

  constructor(private readonly options: AdapterHostClientOptions) {}

  async request(request: AdapterHostRequest): Promise<unknown> {
    if (this.closed) throw new AdapterHostError("Adapter host client closed");
    request.signal?.throwIfAborted();
    const namespace = request.persistenceNamespace;
    if (
      !namespace ||
      request.method === "describe" ||
      request.method === "action" ||
      request.method === "job"
    )
      return this.ephemeral(request);
    let slot = this.slots.get(namespace);
    if (!slot) {
      slot = { tail: Promise.resolve(), pending: 0 };
      this.slots.set(namespace, slot);
    }
    if (slot.idleTimer) clearTimeout(slot.idleTimer);
    slot.pending++;
    const current = slot;
    const result = current.tail.then(async () => {
      if (this.closed || this.slots.get(namespace) !== current)
        throw new AdapterHostError("Adapter service host invalidated");
      request.signal?.throwIfAborted();
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(request.connection ?? {}))
        .digest("hex");
      if (current.session && current.fingerprint !== fingerprint) {
        await current.session.close();
        current.session = undefined;
      }
      if (!current.session) {
        const allocated = this.allocation.then(async () => {
          if (this.closed)
            throw new AdapterHostError("Adapter host client closed");
          if (!(await this.makeRoom(current))) return false;
          current.session = new HostSession(this.options);
          current.fingerprint = fingerprint;
          return true;
        });
        this.allocation = allocated.then(
          () => undefined,
          () => undefined,
        );
        if (!(await allocated)) return this.ephemeral(request);
      }
      try {
        if (!current.session)
          throw new AdapterHostError("Adapter host unavailable");
        return await current.session.request(request);
      } catch (error) {
        await current.session?.close(true);
        current.session = undefined;
        throw error;
      }
    });
    current.tail = result
      .then(
        () => undefined,
        () => undefined,
      )
      .then(() => {
        current.pending--;
        if (current.pending === 0 && this.slots.get(namespace) === current) {
          current.idleTimer = setTimeout(
            () => {
              void this.invalidateService(namespace);
            },
            request.hostIdleTimeoutMs ??
              this.options.hostIdleTimeoutMs ??
              300_000,
          );
          current.idleTimer.unref();
        }
      });
    return result;
  }

  private async makeRoom(current: HostSlot): Promise<boolean> {
    const live = [...this.slots.entries()].filter(([, slot]) => slot.session);
    if (live.length < (this.options.maxHosts ?? 16)) return true;
    const idle = live.find(
      ([, slot]) => slot !== current && slot.pending === 0,
    );
    if (!idle) return false;
    await this.invalidateService(idle[0]);
    return true;
  }

  private readonly ephemeralSessions = new Set<HostSession>();

  private async ephemeral(request: AdapterHostRequest): Promise<unknown> {
    if (this.closed) throw new AdapterHostError("Adapter host client closed");
    const session = new HostSession(this.options);
    this.ephemeralSessions.add(session);
    try {
      return await session.request(request);
    } finally {
      await session.close();
      this.ephemeralSessions.delete(session);
    }
  }

  async invalidateService(namespace: string): Promise<void> {
    const slot = this.slots.get(namespace);
    if (!slot) return;
    this.slots.delete(namespace);
    if (slot.idleTimer) clearTimeout(slot.idleTimer);
    // Let an active read finish when config refresh retires its host.
    await slot.tail;
    await slot.session?.close();
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.allocation;
    await Promise.all(
      [...this.slots.values()].map((slot) => slot.session?.close()),
    );
    await Promise.all(
      [...this.ephemeralSessions].map((session) => session.close(true)),
    );
    await Promise.all(
      [...this.slots.keys()].map((namespace) =>
        this.invalidateService(namespace),
      ),
    );
  }
}
