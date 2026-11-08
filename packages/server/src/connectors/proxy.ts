import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type Server, type Socket } from "node:net";
import type { TunnelManager, TunnelStream } from "./manager";
import { TunnelError } from "./protocol";

const MAX_HEAD = 16 * 1024;
const HEAD_END = Buffer.from("\r\n\r\n");

/**
 * A forward proxy that only listens on loopback. Adapter processes reach
 * private sources through it (HTTPS_PROXY), and each connection is carried over
 * the agent tunnel. It forwards bytes and never reads credentials or bodies, so
 * any auth scheme, TLS setup or reverse proxy in front of the source keeps
 * working unchanged.
 */
export class ConnectorProxy {
  private server: Server | undefined;
  private port = 0;
  private readonly sockets = new Set<Socket>();
  /** Only this process's children know it, so nothing else can use the proxy. */
  private readonly secret = randomBytes(24).toString("hex");

  constructor(private readonly manager: TunnelManager) {}

  async start(): Promise<void> {
    if (this.server) return;
    const server = createServer({ allowHalfOpen: true }, (socket) => {
      this.sockets.add(socket);
      socket.once("close", () => this.sockets.delete(socket));
      this.accept(socket);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    this.port = typeof address === "object" && address ? address.port : 0;
    this.server = server;
  }

  /** The proxy URL to give to a process that must go through `connectorId`. */
  urlFor(connectorId: string): string {
    if (!this.server) throw new Error("Connector proxy is not running");
    return `http://${encodeURIComponent(connectorId)}:${this.secret}@127.0.0.1:${this.port}`;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    server.close();
    for (const socket of this.sockets) socket.destroy();
  }

  private accept(socket: Socket): void {
    socket.on("error", () => socket.destroy());
    let buffered = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      const end = buffered.indexOf(HEAD_END);
      if (end === -1) {
        if (buffered.length > MAX_HEAD)
          refuse(socket, 431, "Request header too large");
        return;
      }
      socket.off("data", onData);
      socket.pause();
      void this.handle(
        socket,
        buffered.subarray(0, end).toString("latin1"),
        buffered.subarray(end + HEAD_END.length),
      );
    };
    socket.on("data", onData);
  }

  private async handle(
    socket: Socket,
    head: string,
    rest: Buffer,
  ): Promise<void> {
    const lines = head.split("\r\n");
    const requestLine = lines[0] ?? "";
    const headers = lines.slice(1);
    const connectorId = this.authenticate(headers);
    if (!connectorId)
      return refuse(socket, 407, "Proxy authentication required", {
        "Proxy-Authenticate": 'Basic realm="dsui-connector"',
      });

    const parts = requestLine.split(" ");
    const method = parts[0] ?? "";
    const targetText = parts[1] ?? "";
    let target: string;
    let forwardedHead: Buffer | undefined;
    if (method === "CONNECT") {
      target = targetText;
    } else {
      let url: URL;
      try {
        url = new URL(targetText);
      } catch {
        return refuse(socket, 400, "Expected an absolute URI or CONNECT");
      }
      if (url.protocol !== "http:")
        return refuse(
          socket,
          400,
          "Only http:// can be forwarded without CONNECT",
        );
      target = `${url.hostname}:${url.port || "80"}`;
      forwardedHead = rewriteHead(method, url, parts[2] ?? "HTTP/1.1", headers);
    }
    if (!/^[^\s:]+:\d{1,5}$|^\[[0-9a-fA-F:]+\]:\d{1,5}$/.test(target))
      return refuse(socket, 400, "Invalid target");

    let stream: TunnelStream;
    try {
      stream = await this.manager.openStream(connectorId, target);
    } catch (error) {
      const code = error instanceof TunnelError ? error.code : "unreachable";
      const status =
        code === "not_allowed" ? 403 : code === "timeout" ? 504 : 502;
      return refuse(
        socket,
        status,
        `DSUI agent: ${error instanceof Error ? error.message : "cannot reach the target"}`,
      );
    }
    if (socket.destroyed) {
      stream.reset();
      return;
    }
    if (method === "CONNECT")
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    bridge(socket, stream, forwardedHead, rest);
  }

  private authenticate(headers: string[]): string | null {
    const line = headers.find((header) =>
      /^proxy-authorization:/i.test(header),
    );
    const match = line ? /basic\s+([A-Za-z0-9+/=]+)/i.exec(line) : null;
    if (!match?.[1]) return null;
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    const secret = Buffer.from(decoded.slice(separator + 1));
    const expected = Buffer.from(this.secret);
    if (secret.length !== expected.length || !timingSafeEqual(secret, expected))
      return null;
    try {
      return decodeURIComponent(decoded.slice(0, separator));
    } catch {
      return null;
    }
  }
}

/** Origin-form request line, no proxy headers, and no keep-alive across targets. */
function rewriteHead(
  method: string,
  url: URL,
  version: string,
  headers: string[],
): Buffer {
  const kept = headers.filter(
    (header) =>
      !/^(proxy-authorization|proxy-connection|connection):/i.test(header),
  );
  const lines = [
    `${method} ${url.pathname}${url.search} ${version}`,
    ...kept,
    "Connection: close",
  ];
  return Buffer.from(`${lines.join("\r\n")}\r\n\r\n`, "latin1");
}

function refuse(
  socket: Socket,
  status: number,
  message: string,
  extra: Record<string, string> = {},
): void {
  const reasons: Record<number, string> = {
    400: "Bad Request",
    403: "Forbidden",
    407: "Proxy Authentication Required",
    431: "Request Header Fields Too Large",
    502: "Bad Gateway",
    504: "Gateway Timeout",
  };
  const extraHeaders = Object.entries(extra)
    .map(([k, v]) => `${k}: ${v}\r\n`)
    .join("");
  const body = `${message}\n`;
  socket.end(
    `HTTP/1.1 ${status} ${reasons[status] ?? "Error"}\r\n${extraHeaders}Content-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
  );
}

function bridge(
  socket: Socket,
  stream: TunnelStream,
  head: Buffer | undefined,
  rest: Buffer,
): void {
  stream.attach({
    data: (chunk) => {
      if (socket.destroyed) return;
      socket.write(chunk, () => stream.consumed(chunk.length));
    },
    remoteClose: () => {
      if (!socket.destroyed) socket.end();
    },
    reset: () => socket.destroy(),
  });
  const forward = async (chunk: Buffer) => {
    socket.pause();
    try {
      await stream.write(chunk);
      socket.resume();
    } catch {
      socket.destroy();
    }
  };
  socket.on("data", (chunk: Buffer) => void forward(chunk));
  socket.on("end", () => stream.end());
  socket.on("close", () => stream.reset());
  // One buffer keeps the rewritten head and any body bytes already read in order.
  const initial = Buffer.concat([head ?? Buffer.alloc(0), rest]);
  if (initial.length > 0) void forward(initial);
  else socket.resume();
}
