import type { Server, ServerWebSocket, WebSocketHandler } from "bun";
import type { ConnectorRow, DsuiDatabase } from "../db/database";
import {
  type ControlMessage,
  decodeFrame,
  encodeFrame,
  FrameType,
  INITIAL_WINDOW,
  MAX_FRAME,
  MAX_PAYLOAD,
  type OpenErrorCode,
  PROTOCOL_VERSION,
  parseWindow,
  TUNNEL_PATH,
  TunnelError,
  windowPayload,
} from "./protocol";
import { parseToken, secretMatches } from "./tokens";

const MAX_STREAMS_PER_AGENT = 128;
const HELLO_TIMEOUT_MS = 15_000;
const OPEN_TIMEOUT_MS = 20_000;
/** An agent is online while its socket is open and it heartbeated recently. */
export const ONLINE_GRACE_MS = 90_000;

export interface SocketData {
  connectorId: string;
  observedIp: string;
}

export interface ConnectorInfo {
  version?: string;
  hostname?: string;
  os?: string;
  arch?: string;
  observedIp?: string;
  localAddrs?: string[];
  targets?: string[];
}

export interface ConnectorStatus {
  online: boolean;
  activeStreams: number;
  info: ConnectorInfo;
}

type StreamEvents = {
  data(chunk: Uint8Array): void;
  /** The agent will send no more data. */
  remoteClose(): void;
  /** The stream is gone: reset by the agent, or the tunnel dropped. */
  reset(reason: string): void;
};

/** One proxied connection, seen from the server. */
export class TunnelStream {
  private credit = INITIAL_WINDOW;
  private creditWaiters: Array<() => void> = [];
  private granted = 0;
  private dead = false;
  private localClosed = false;
  private remoteClosed = false;
  private events: StreamEvents | undefined;
  private queued: Array<() => void> = [];
  openResult:
    | { resolve(): void; reject(error: Error): void; timer: Timer }
    | undefined;

  constructor(
    readonly id: number,
    private readonly session: AgentSession,
  ) {}

  /** Attaches handlers; anything that arrived before is delivered first. */
  attach(events: StreamEvents): void {
    this.events = events;
    const pending = this.queued;
    this.queued = [];
    for (const run of pending) run();
  }

  private emit(run: () => void): void {
    if (this.events) run();
    else this.queued.push(run);
  }

  /** Sends bytes to the target, waiting for credit as needed. */
  async write(chunk: Uint8Array): Promise<void> {
    for (let offset = 0; offset < chunk.length; ) {
      while (this.credit <= 0 && !this.dead)
        await new Promise<void>((resolve) => this.creditWaiters.push(resolve));
      if (this.dead)
        throw new TunnelError("unreachable", "Tunnel stream closed");
      const size = Math.min(chunk.length - offset, MAX_PAYLOAD, this.credit);
      this.credit -= size;
      this.session.send(
        encodeFrame(
          FrameType.Data,
          this.id,
          chunk.subarray(offset, offset + size),
        ),
      );
      offset += size;
    }
  }

  /** The caller finished writing (half close). */
  end(): void {
    if (this.dead || this.localClosed) return;
    this.localClosed = true;
    this.session.send(encodeFrame(FrameType.Close, this.id));
    this.finishIfDone();
  }

  /** Tells the agent the bytes it sent were handed on, so it may send more. */
  consumed(bytes: number): void {
    if (this.dead) return;
    this.granted += bytes;
    if (this.granted < INITIAL_WINDOW / 4) return;
    const give = this.granted;
    this.granted = 0;
    this.session.send(
      encodeFrame(FrameType.Window, this.id, windowPayload(give)),
    );
  }

  reset(): void {
    if (this.dead) return;
    this.session.send(encodeFrame(FrameType.Reset, this.id));
    this.die("reset by server");
  }

  // Called by the session for incoming frames.
  receive(type: number, payload: Uint8Array): void {
    switch (type) {
      case FrameType.Data: {
        const copy = payload.slice();
        this.emit(() => this.events?.data(copy));
        break;
      }
      case FrameType.Window:
        this.credit += parseWindow(payload);
        for (const wake of this.creditWaiters.splice(0)) wake();
        break;
      case FrameType.Close:
        this.remoteClosed = true;
        this.emit(() => this.events?.remoteClose());
        this.finishIfDone();
        break;
      case FrameType.Reset:
        this.die("reset by agent");
        break;
    }
  }

  die(reason: string): void {
    if (this.dead) return;
    this.dead = true;
    if (this.openResult) {
      clearTimeout(this.openResult.timer);
      this.openResult.reject(new TunnelError("unreachable", reason));
      this.openResult = undefined;
    }
    for (const wake of this.creditWaiters.splice(0)) wake();
    this.session.streams.delete(this.id);
    this.emit(() => this.events?.reset(reason));
  }

  private finishIfDone(): void {
    if (this.localClosed && this.remoteClosed) {
      this.dead = true;
      this.session.streams.delete(this.id);
    }
  }
}

class AgentSession {
  readonly streams = new Map<number, TunnelStream>();
  private nextId = 1;
  ready = false;
  lastHeartbeat = Date.now();
  info: ConnectorInfo = {};
  helloTimer: Timer | undefined;

  constructor(readonly ws: ServerWebSocket<SocketData>) {}

  send(frame: Uint8Array): void {
    if (this.ws.send(frame) === 0) this.ws.close(1011, "send failed");
  }

  allocate(): TunnelStream | undefined {
    if (this.streams.size >= MAX_STREAMS_PER_AGENT) return undefined;
    const stream = new TunnelStream(this.nextId++, this);
    this.streams.set(stream.id, stream);
    return stream;
  }

  failAll(reason: string): void {
    for (const stream of [...this.streams.values()]) stream.die(reason);
  }
}

export interface TunnelManagerOptions {
  database: DsuiDatabase;
  /** Trust X-Forwarded-For for the address shown to the user (behind Caddy). */
  trustProxyHeaders?: boolean;
  log?: (message: string, fields?: Record<string, unknown>) => void;
}

export class TunnelManager {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(private readonly options: TunnelManagerOptions) {}

  matches(request: Request): boolean {
    return new URL(request.url).pathname.endsWith(TUNNEL_PATH);
  }

  /** Authenticates and upgrades. Returns a Response only when refusing. */
  handleUpgrade(
    request: Request,
    server: Server<SocketData>,
  ): Response | undefined {
    const bearer = /^Bearer (.+)$/.exec(
      request.headers.get("authorization") ?? "",
    );
    const parsed = bearer?.[1] ? parseToken(bearer[1]) : null;
    const row = parsed
      ? this.options.database.getConnector(parsed.connectorId)
      : null;
    // One answer for every failure so tokens cannot be probed.
    if (
      !parsed ||
      !row ||
      row.revoked_at ||
      !secretMatches(parsed.secret, row.token_hash)
    )
      return new Response("unauthorized", { status: 401 });
    const upgraded = server.upgrade(request, {
      data: {
        connectorId: row.id,
        observedIp: this.clientIp(request, server),
      } satisfies SocketData,
    });
    return upgraded
      ? undefined
      : new Response("expected a WebSocket upgrade", { status: 426 });
  }

  private clientIp(request: Request, server: Server<SocketData>): string {
    if (this.options.trustProxyHeaders) {
      const forwarded = request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim();
      if (forwarded) return forwarded;
    }
    return server.requestIP(request)?.address ?? "";
  }

  readonly websocket: WebSocketHandler<SocketData> = {
    maxPayloadLength: MAX_FRAME + 1024,
    idleTimeout: 120,
    sendPings: true,
    perMessageDeflate: false,
    open: (ws) => {
      const previous = this.sessions.get(ws.data.connectorId);
      const session = new AgentSession(ws);
      this.sessions.set(ws.data.connectorId, session);
      // One live agent per connector: a newer connection replaces the older one.
      if (previous) {
        previous.failAll("replaced by a newer connection");
        previous.ws.close(4000, "replaced by a newer connection");
      }
      session.helloTimer = setTimeout(
        () => ws.close(4001, "hello timeout"),
        HELLO_TIMEOUT_MS,
      );
    },
    message: (ws, message) => {
      const session = this.sessions.get(ws.data.connectorId);
      if (!session || session.ws !== ws) return;
      if (typeof message === "string") this.control(session, message);
      else if (session.ready) this.frame(session, message);
    },
    close: (ws) => {
      const session = this.sessions.get(ws.data.connectorId);
      if (!session || session.ws !== ws) return;
      clearTimeout(session.helloTimer);
      this.sessions.delete(ws.data.connectorId);
      session.failAll("tunnel dropped");
      this.options.database.recordConnectorSeen(ws.data.connectorId);
    },
  };

  private control(session: AgentSession, text: string): void {
    let message: ControlMessage;
    try {
      message = JSON.parse(text) as ControlMessage;
    } catch {
      return;
    }
    const { connectorId, observedIp } = session.ws.data;
    if (message.type === "hello" && !session.ready) {
      if (message.protocol !== PROTOCOL_VERSION) {
        session.ws.send(
          JSON.stringify({
            type: "error",
            code: "protocol",
            message: `unsupported protocol version ${message.protocol}; this server speaks ${PROTOCOL_VERSION}`,
          }),
        );
        session.ws.close(4002, "unsupported protocol");
        return;
      }
      clearTimeout(session.helloTimer);
      session.info = {
        version: str(message.version),
        hostname: str(message.hostname),
        os: str(message.os),
        arch: str(message.arch),
        observedIp,
        localAddrs: strings(message.localAddrs),
        targets: strings(message.targets),
      };
      // The agent's display name only seeds the connector when it is unnamed.
      this.options.database.recordConnectorConnected(connectorId, {
        ...session.info,
      });
      session.ready = true;
      session.lastHeartbeat = Date.now();
      session.ws.send(
        JSON.stringify({
          type: "ready",
          observedIp,
          maxStreams: MAX_STREAMS_PER_AGENT,
        }),
      );
      this.options.log?.("agent connected", { connectorId, observedIp });
      return;
    }
    if (message.type === "heartbeat" && session.ready) {
      session.lastHeartbeat = Date.now();
      if (message.targets)
        session.info = { ...session.info, targets: strings(message.targets) };
      this.options.database.recordConnectorSeen(connectorId, {
        ...session.info,
      });
    }
  }

  private frame(
    session: AgentSession,
    data: Uint8Array | Buffer | ArrayBuffer,
  ): void {
    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const frame = decodeFrame(bytes);
    if (!frame) return;
    const stream = session.streams.get(frame.stream);
    if (!stream) {
      if (frame.type === FrameType.Data)
        session.send(encodeFrame(FrameType.Reset, frame.stream));
      return;
    }
    if (frame.type === FrameType.OpenOk) {
      if (stream.openResult) {
        clearTimeout(stream.openResult.timer);
        stream.openResult.resolve();
        stream.openResult = undefined;
      }
      return;
    }
    if (frame.type === FrameType.OpenErr) {
      let body: { code?: string; message?: string } = {};
      try {
        body = JSON.parse(new TextDecoder().decode(frame.payload));
      } catch {
        // Keep the defaults below.
      }
      const pending = stream.openResult;
      stream.openResult = undefined;
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(
          new TunnelError(
            (body.code as OpenErrorCode) ?? "unreachable",
            body.message ?? "agent could not open the target",
          ),
        );
      }
      session.streams.delete(stream.id);
      return;
    }
    stream.receive(frame.type, frame.payload);
  }

  /** Opens a TCP stream to `host:port` from the agent's network. */
  async openStream(connectorId: string, target: string): Promise<TunnelStream> {
    const session = this.sessions.get(connectorId);
    if (!session?.ready)
      throw new TunnelError(
        "offline",
        "The DSUI agent for this service is offline",
      );
    const stream = session.allocate();
    if (!stream)
      throw new TunnelError(
        "too_many_streams",
        "The DSUI agent has too many open connections",
      );
    const opened = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        stream.openResult = undefined;
        session.streams.delete(stream.id);
        session.send(encodeFrame(FrameType.Reset, stream.id));
        reject(
          new TunnelError("timeout", "The DSUI agent did not answer in time"),
        );
      }, OPEN_TIMEOUT_MS);
      stream.openResult = { resolve, reject, timer };
    });
    session.send(
      encodeFrame(FrameType.Open, stream.id, new TextEncoder().encode(target)),
    );
    await opened;
    return stream;
  }

  status(connector: ConnectorRow): ConnectorStatus {
    const session = this.sessions.get(connector.id);
    const online = Boolean(
      session?.ready && Date.now() - session.lastHeartbeat < ONLINE_GRACE_MS,
    );
    let info: ConnectorInfo = {};
    try {
      info = JSON.parse(connector.info) as ConnectorInfo;
    } catch {
      // A damaged row still lists; it just has no details.
    }
    return {
      online,
      activeStreams: session?.streams.size ?? 0,
      info: online && session ? { ...info, ...session.info } : info,
    };
  }

  /** Drops the live connection, for revoke, rotate and delete. */
  disconnect(connectorId: string, reason: string): void {
    const session = this.sessions.get(connectorId);
    if (!session) return;
    this.sessions.delete(connectorId);
    session.failAll(reason);
    session.ws.close(4003, reason);
  }

  close(): void {
    for (const id of [...this.sessions.keys()])
      this.disconnect(id, "server shutting down");
  }
}

const str = (value: unknown): string | undefined =>
  typeof value === "string" ? value.slice(0, 200) : undefined;

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, 100)
        .map((item) => item.slice(0, 200))
    : undefined;
