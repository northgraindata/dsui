import { createHash } from "node:crypto";

interface Session<T> {
  value?: T;
  fingerprint?: string;
  tail: Promise<void>;
  pending: number;
  closing: boolean;
  closePromise?: Promise<void>;
}

/** Host-owned service sessions. Never evict live state to make room. */
export class SessionPool<T> {
  private readonly sessions = new Map<string, Session<T>>();
  private closed = false;

  constructor(
    private readonly create: (connection: unknown) => Promise<T>,
    private readonly destroy: (value: T) => Promise<void>,
    private readonly capacity = 64,
  ) {}

  async run<R>(
    id: string,
    connection: unknown,
    operation: (value: T) => Promise<R>,
  ): Promise<R> {
    if (this.closed) throw new Error("Adapter sessions are closed");
    let session = this.sessions.get(id);
    if (!session) {
      if (this.sessions.size >= this.capacity)
        throw new Error("Adapter session capacity reached");
      session = { tail: Promise.resolve(), pending: 0, closing: false };
      this.sessions.set(id, session);
    }
    if (session.closing) throw new Error("Adapter session is closing");
    if (session.pending >= 128)
      throw new Error("Adapter session queue is full");
    const entry = session;
    // Credentials never appear in the map key or diagnostics.
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(connection ?? null))
      .digest("hex");
    entry.pending++;
    const result = entry.tail.then(async () => {
      if (entry.value !== undefined && entry.fingerprint !== fingerprint) {
        const previous = entry.value;
        entry.value = undefined;
        await this.destroy(previous);
      }
      if (entry.value === undefined) {
        entry.value = await this.create(connection);
        entry.fingerprint = fingerprint;
      }
      return operation(entry.value);
    });
    entry.tail = result
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        entry.pending--;
      });
    return result;
  }

  async close(id: string): Promise<void> {
    const entry = this.sessions.get(id);
    if (!entry) return;
    if (entry.closePromise) return entry.closePromise;
    entry.closing = true;
    entry.closePromise = (async () => {
      await entry.tail;
      try {
        if (entry.value !== undefined) await this.destroy(entry.value);
      } finally {
        this.sessions.delete(id);
      }
    })();
    return entry.closePromise;
  }

  async dispose(): Promise<void> {
    this.closed = true;
    const results = await Promise.allSettled(
      [...this.sessions.keys()].map((id) => this.close(id)),
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length)
      throw new AggregateError(
        failures.map((result) => result.reason),
        "Could not close adapter sessions",
      );
  }
}
