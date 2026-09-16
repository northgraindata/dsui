export type ProcessOutputStream = "stdout" | "stderr";

export interface ProcessOutputChunk {
  readonly stream: ProcessOutputStream;
  readonly text: string;
}

export interface ProcessRunRequest {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  /** Values are redacted before output is returned or delivered to onOutput. */
  readonly sensitiveValues?: readonly string[];
  readonly onOutput?: (chunk: ProcessOutputChunk) => void | Promise<void>;
}

export interface ProcessRunResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface ProcessRunnerOptions {
  readonly allowedCommands?: readonly string[];
  readonly defaultTimeoutMs?: number;
  readonly defaultMaxOutputBytes?: number;
}

export type ProcessRunnerErrorCode =
  | "COMMAND_NOT_ALLOWED"
  | "CANCELLED"
  | "TIMEOUT"
  | "OUTPUT_LIMIT"
  | "SPAWN_FAILED";

export class ProcessRunnerError extends Error {
  constructor(
    readonly code: ProcessRunnerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProcessRunnerError";
  }
}

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function redact(text: string, sensitiveValues: readonly string[]): string {
  return sensitiveValues.reduce((result, value) => {
    if (value.length < 4) return result;
    return result.split(value).join("[REDACTED]");
  }, text);
}

async function readOutput(
  stream: ReadableStream<Uint8Array> | null,
  streamName: ProcessOutputStream,
  maxOutputBytes: number,
  sensitiveValues: readonly string[],
  onOutput: ProcessRunRequest["onOutput"],
  state: { bytes: number },
): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: string[] = [];
  const decoder = new TextDecoder();

  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      state.bytes += next.value.byteLength;
      if (state.bytes > maxOutputBytes)
        throw new ProcessRunnerError(
          "OUTPUT_LIMIT",
          "Process output exceeds the configured limit",
        );
      const text = redact(
        decoder.decode(next.value, { stream: true }),
        sensitiveValues,
      );
      chunks.push(text);
      await onOutput?.({ stream: streamName, text });
    }
    const remainder = redact(decoder.decode(), sensitiveValues);
    if (remainder) {
      chunks.push(remainder);
      await onOutput?.({ stream: streamName, text: remainder });
    }
  } finally {
    reader.releaseLock();
  }

  return chunks.join("");
}

export class LocalProcessRunner {
  private readonly allowedCommands?: ReadonlySet<string>;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxOutputBytes: number;

  constructor(options: ProcessRunnerOptions = {}) {
    this.allowedCommands = options.allowedCommands
      ? new Set(options.allowedCommands)
      : undefined;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultMaxOutputBytes =
      options.defaultMaxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  }

  async run(request: ProcessRunRequest): Promise<ProcessRunResult> {
    if (this.allowedCommands && !this.allowedCommands.has(request.command))
      throw new ProcessRunnerError(
        "COMMAND_NOT_ALLOWED",
        `Command is not allowed: ${request.command}`,
      );

    const args = [...(request.args ?? [])];
    const startedAt = performance.now();
    let child: Bun.Subprocess;
    try {
      child = Bun.spawn([request.command, ...args], {
        cwd: request.cwd,
        env: request.env ? { ...process.env, ...request.env } : undefined,
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (error) {
      throw new ProcessRunnerError(
        "SPAWN_FAILED",
        `Could not start process: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const maxOutputBytes = request.maxOutputBytes ?? this.defaultMaxOutputBytes;
    const outputState = { bytes: 0 };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    let terminationError: ProcessRunnerError | undefined;

    const termination = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        terminationError = new ProcessRunnerError(
          "TIMEOUT",
          `Process timed out after ${timeoutMs}ms`,
        );
        child.kill();
        reject(terminationError);
      }, timeoutMs);
      abort = () => {
        terminationError = new ProcessRunnerError(
          "CANCELLED",
          "Process was cancelled",
        );
        child.kill();
        reject(terminationError);
      };
      if (request.signal?.aborted) abort();
      else request.signal?.addEventListener("abort", abort, { once: true });
    });

    try {
      const output = Promise.all([
        readOutput(
          typeof child.stdout === "number" || child.stdout === undefined
            ? null
            : child.stdout,
          "stdout",
          maxOutputBytes,
          request.sensitiveValues ?? [],
          request.onOutput,
          outputState,
        ),
        readOutput(
          typeof child.stderr === "number" || child.stderr === undefined
            ? null
            : child.stderr,
          "stderr",
          maxOutputBytes,
          request.sensitiveValues ?? [],
          request.onOutput,
          outputState,
        ),
        child.exited,
      ]);
      const [stdout, stderr, exitCode] = await Promise.race([
        output,
        termination,
      ]);
      return {
        command: request.command,
        args,
        exitCode,
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      if (error instanceof ProcessRunnerError) throw error;
      throw new ProcessRunnerError(
        terminationError?.code ?? "SPAWN_FAILED",
        terminationError?.message ??
          `Process failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
      if (request.signal && abort)
        request.signal.removeEventListener("abort", abort);
      child.kill();
    }
  }
}
