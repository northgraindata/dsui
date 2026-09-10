import { randomUUID } from "node:crypto";
import {
  type AdapterHostClientOptions,
  AdapterHostError,
  type AdapterHostRequest,
} from "./host";

/** One subprocess per configured service. Its caller serializes requests. */
export class HostSession {
  private readonly child;
  private readonly reader;
  private readonly decoder = new TextDecoder();
  private broken = false;
  private stderrBytes = 0;

  constructor(private readonly options: AdapterHostClientOptions) {
    this.child = Bun.spawn(
      [options.command, ...(options.args ?? []), "--session"],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    this.reader = this.child.stdout.getReader();
    void this.drainErrors();
  }

  private async drainErrors() {
    try {
      for await (const chunk of this.child.stderr) {
        this.stderrBytes += chunk.byteLength;
        if (this.stderrBytes > (this.options.maxOutputBytes ?? 256 * 1024)) {
          this.broken = true;
          this.child.kill();
          break;
        }
      }
    } catch {
      this.broken = true;
      this.child.kill();
    }
  }

  async request(
    request: AdapterHostRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    signal?.throwIfAborted();
    if (this.broken)
      throw new AdapterHostError(
        "Adapter session was lost; reconnect the service before continuing",
      );
    const id = randomUUID();
    const input = `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: request.method,
      params: {
        connection: request.connection ?? {},
        target: request.target,
        input: request.input,
      },
    })}\n`;
    const max = this.options.maxOutputBytes ?? 256 * 1024;
    if (Buffer.byteLength(input) > max)
      throw new AdapterHostError("Host request exceeds output limit");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      const fail = (message: string) => {
        this.broken = true;
        this.child.kill();
        reject(new AdapterHostError(message));
      };
      timer = setTimeout(
        () => fail("Adapter host timed out; session was closed"),
        this.options.timeoutMs ?? 10_000,
      );
      abort = () => fail("Adapter action cancelled; session was closed");
      signal?.addEventListener("abort", abort, { once: true });
    });
    try {
      const exchange = async () => {
        this.child.stdin.write(input);
        await this.child.stdin.flush();
        let text = "";
        let bytes = 0;
        for (;;) {
          const chunk = await this.reader.read();
          if (chunk.done)
            throw new AdapterHostError("Adapter session exited unexpectedly");
          bytes += chunk.value.byteLength;
          if (bytes > max)
            throw new AdapterHostError(
              "Adapter host stdout exceeds output limit",
            );
          text += this.decoder.decode(chunk.value, { stream: true });
          if (!text.includes("\n")) continue;
          if (!text.endsWith("\n") || text.trim().includes("\n"))
            throw new AdapterHostError(
              "Invalid adapter session response framing",
            );
          const response: unknown = JSON.parse(text);
          if (
            !response ||
            typeof response !== "object" ||
            !("jsonrpc" in response) ||
            response.jsonrpc !== "2.0" ||
            !("id" in response) ||
            response.id !== id
          )
            throw new AdapterHostError(
              "Invalid adapter session response identity",
            );
          return response;
        }
      };
      const response = await Promise.race([exchange(), cancelled]);
      if ("error" in response) {
        const error = response.error;
        if (
          !error ||
          typeof error !== "object" ||
          !("message" in error) ||
          typeof error.message !== "string"
        )
          throw new AdapterHostError("Invalid adapter session error");
        // Operation errors do not destroy a healthy session.
        return { sessionError: error.message };
      }
      if (!("result" in response))
        throw new AdapterHostError("Adapter session returned no result");
      return response.result;
    } catch (error) {
      this.broken = true;
      this.child.kill();
      throw error;
    } finally {
      clearTimeout(timer);
      if (abort) signal?.removeEventListener("abort", abort);
    }
  }

  async dispose(): Promise<void> {
    this.broken = true;
    this.child.stdin.end();
    const timer = setTimeout(() => this.child.kill(), 2_000);
    try {
      await this.child.exited;
    } finally {
      clearTimeout(timer);
      this.reader.releaseLock();
    }
  }
}
