import { afterEach, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { connect, createServer, type Server as NetServer } from "node:net";
import { Hono } from "hono";
import { AdapterHostClient } from "../src/adapters/host";
import { type SocketData, TunnelManager } from "../src/connectors/manager";
import {
  decodeFrame,
  encodeFrame,
  FrameType,
  MAX_PAYLOAD,
} from "../src/connectors/protocol";
import { ConnectorProxy } from "../src/connectors/proxy";
import {
  CONNECTOR_KEY,
  createConnectorRouting,
  routeConnection,
  setConnectorRouting,
} from "../src/connectors/routing";
import {
  issueToken,
  parseToken,
  secretMatches,
} from "../src/connectors/tokens";
import { DsuiDatabase } from "../src/db/database";
import { registerConnectorRoutes } from "../src/routes/connectors";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  setConnectorRouting(undefined);
});

function createConnector(database: DsuiDatabase, name = "site-a") {
  const id = crypto.randomUUID();
  const issued = issueToken(id);
  database.insertConnector({
    id,
    name,
    token_hash: issued.tokenHash,
    created_by: "test",
  });
  return { id, token: issued.token };
}

function startStack() {
  const database = new DsuiDatabase(":memory:");
  const tunnel = new TunnelManager({ database });
  const server = Bun.serve<SocketData>({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request, bunServer) =>
      tunnel.matches(request)
        ? tunnel.handleUpgrade(request, bunServer)
        : new Response("not the tunnel"),
    websocket: tunnel.websocket,
  });
  const proxy = new ConnectorProxy(tunnel);
  cleanups.push(async () => {
    tunnel.close();
    await proxy.close();
    void server.stop(true);
    database.close();
  });
  return {
    database,
    tunnel,
    proxy,
    tunnelUrl: `ws://127.0.0.1:${server.port}/api/v1/connectors/tunnel`,
  };
}

/** A minimal agent: a real TCP forwarder with no flow control. */
async function fakeAgent(tunnelUrl: string, token: string) {
  const ws = new WebSocket(tunnelUrl, {
    headers: { Authorization: `Bearer ${token}` },
  } as unknown as string[]);
  ws.binaryType = "arraybuffer";
  const sockets = new Map<number, ReturnType<typeof connect>>();
  const ready = new Promise<Record<string, unknown>>((resolve, reject) => {
    ws.onerror = () => reject(new Error("agent could not connect"));
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: "hello",
          protocol: 1,
          version: "test",
          hostname: "fake-host",
          targets: ["*:*"],
        }),
      );
    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const message = JSON.parse(event.data) as Record<string, unknown>;
        if (message.type === "ready") resolve(message);
        return;
      }
      const frame = decodeFrame(new Uint8Array(event.data as ArrayBuffer));
      if (!frame) return;
      const socket = sockets.get(frame.stream);
      switch (frame.type) {
        case FrameType.Open: {
          const [host, port] = new TextDecoder()
            .decode(frame.payload)
            .split(":");
          const upstream = connect(Number(port), host);
          sockets.set(frame.stream, upstream);
          upstream.on("connect", () =>
            ws.send(encodeFrame(FrameType.OpenOk, frame.stream)),
          );
          upstream.on("error", (error) => {
            sockets.delete(frame.stream);
            ws.send(
              encodeFrame(
                FrameType.OpenErr,
                frame.stream,
                new TextEncoder().encode(
                  JSON.stringify({
                    code: "unreachable",
                    message: error.message,
                  }),
                ),
              ),
            );
          });
          upstream.on("data", (chunk: Buffer) => {
            for (let i = 0; i < chunk.length; i += MAX_PAYLOAD)
              ws.send(
                encodeFrame(
                  FrameType.Data,
                  frame.stream,
                  chunk.subarray(i, i + MAX_PAYLOAD),
                ),
              );
          });
          upstream.on("end", () =>
            ws.send(encodeFrame(FrameType.Close, frame.stream)),
          );
          break;
        }
        case FrameType.Data:
          socket?.write(frame.payload);
          break;
        case FrameType.Close:
          socket?.end();
          break;
        case FrameType.Reset:
          socket?.destroy();
          break;
      }
    };
  });
  cleanups.push(() => ws.close());
  return { ws, ready: await ready };
}

async function targetServer(
  handler: (request: Request) => Response | Promise<Response>,
) {
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handler });
  cleanups.push(() => void server.stop(true));
  return {
    address: `127.0.0.1:${server.port}`,
    stop: () => void server.stop(true),
  };
}

async function targetAddress(
  handler: (request: Request) => Response | Promise<Response>,
): Promise<string> {
  return (await targetServer(handler)).address;
}

describe("tokens", () => {
  test("round trip and constant time comparison", () => {
    const issued = issueToken("11111111-2222-3333-4444-555555555555");
    const parsed = parseToken(issued.token);
    expect(parsed?.connectorId).toBe("11111111-2222-3333-4444-555555555555");
    expect(secretMatches(parsed?.secret ?? "", issued.tokenHash)).toBe(true);
    expect(secretMatches("wrong", issued.tokenHash)).toBe(false);
    expect(parseToken("garbage")).toBeNull();
  });
});

describe("tunnel endpoint", () => {
  test("refuses unknown, malformed and revoked tokens with the same answer", async () => {
    const { database, tunnelUrl } = startStack();
    const { id, token } = createConnector(database);
    const httpUrl = tunnelUrl.replace("ws://", "http://");
    const attempt = (header?: string) =>
      fetch(httpUrl, { headers: header ? { Authorization: header } : {} });
    expect((await attempt()).status).toBe(401);
    expect((await attempt("Bearer nope")).status).toBe(401);
    expect((await attempt(`Bearer ${token.slice(0, -2)}xx`)).status).toBe(401);
    database.revokeConnector(id);
    expect((await attempt(`Bearer ${token}`)).status).toBe(401);
  });

  test("accepts a valid agent and reports it online with its observed address", async () => {
    const { database, tunnel, tunnelUrl } = startStack();
    const { id, token } = createConnector(database);
    const { ready } = await fakeAgent(tunnelUrl, token);
    expect(ready.observedIp).toBe("127.0.0.1");
    const row = database.getConnector(id);
    if (!row) throw new Error("connector missing");
    const status = tunnel.status(row);
    expect(status.online).toBe(true);
    expect(status.info.hostname).toBe("fake-host");
    expect(status.info.observedIp).toBe("127.0.0.1");
  });

  test("rejects an unsupported protocol version", async () => {
    const { database, tunnelUrl } = startStack();
    const { token } = createConnector(database);
    const ws = new WebSocket(tunnelUrl, {
      headers: { Authorization: `Bearer ${token}` },
    } as unknown as string[]);
    const error = await new Promise<string>((resolve) => {
      ws.onopen = () =>
        ws.send(JSON.stringify({ type: "hello", protocol: 99 }));
      ws.onmessage = (event) => resolve(String(event.data));
    });
    expect(JSON.parse(error).code).toBe("protocol");
  });

  test("revoking disconnects a live agent", async () => {
    const { database, tunnel, tunnelUrl } = startStack();
    const { id, token } = createConnector(database);
    const { ws } = await fakeAgent(tunnelUrl, token);
    const closed = new Promise<void>((resolve) => {
      ws.onclose = () => resolve();
    });
    tunnel.disconnect(id, "revoked");
    await closed;
    const row = database.getConnector(id);
    if (!row) throw new Error("connector missing");
    expect(tunnel.status(row).online).toBe(false);
  });
});

describe("forward proxy", () => {
  async function stack() {
    const s = startStack();
    const connector = createConnector(s.database);
    await s.proxy.start();
    await fakeAgent(s.tunnelUrl, connector.token);
    return { ...s, connector, proxyUrl: s.proxy.urlFor(connector.id) };
  }

  test("carries an HTTP request to a private target (absolute-form)", async () => {
    const { proxyUrl } = await stack();
    const target = await targetAddress(
      (request) =>
        new Response(`hello ${new URL(request.url).pathname}`, {
          headers: {
            "x-saw-proxy-auth": String(
              request.headers.has("proxy-authorization"),
            ),
          },
        }),
    );
    const response = await fetch(`http://${target}/private?x=1`, {
      proxy: proxyUrl,
    });
    expect(await response.text()).toBe("hello /private");
    expect(response.headers.get("x-saw-proxy-auth")).toBe("false");
  });

  test("keeps request bodies and the Host header intact", async () => {
    const { proxyUrl } = await stack();
    const target = await targetAddress(async (request) =>
      Response.json({
        host: request.headers.get("host"),
        body: await request.text(),
      }),
    );
    const response = await fetch(`http://${target}/echo`, {
      method: "POST",
      body: "payload-123",
      proxy: proxyUrl,
    });
    expect(await response.json()).toEqual({
      host: target,
      body: "payload-123",
    });
  });

  test("tunnels raw TCP through CONNECT", async () => {
    const { proxy, connector } = await stack();
    const echo: NetServer = createServer((socket) => socket.pipe(socket));
    await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", resolve));
    cleanups.push(() => new Promise((resolve) => echo.close(() => resolve())));
    const echoPort = (echo.address() as { port: number }).port;
    const credentials = new URL(proxy.urlFor(connector.id));
    const proxyPort = Number(credentials.port);

    const reply = await new Promise<string>((resolve, reject) => {
      const socket = connect(proxyPort, "127.0.0.1");
      let received = "";
      socket.on("error", reject);
      socket.on("data", (chunk) => {
        received += chunk.toString();
        if (received.includes("200") && !received.includes("ping-pong"))
          socket.write("ping-pong");
        if (received.includes("ping-pong")) {
          socket.end();
          resolve(received);
        }
      });
      socket.write(
        `CONNECT 127.0.0.1:${echoPort} HTTP/1.1\r\nHost: 127.0.0.1:${echoPort}\r\nProxy-Authorization: Basic ${Buffer.from(`${connector.id}:${decodeURIComponent(credentials.password)}`).toString("base64")}\r\n\r\n`,
      );
    });
    expect(reply).toContain("200 Connection Established");
    expect(reply).toContain("ping-pong");
  });

  test("refuses clients without the proxy secret", async () => {
    const { proxy, connector } = await stack();
    const port = Number(new URL(proxy.urlFor(connector.id)).port);
    const status = await new Promise<string>((resolve) => {
      const socket = connect(port, "127.0.0.1");
      let data = "";
      socket.on("data", (chunk) => {
        data += chunk;
      });
      socket.on("close", () => resolve(data.split("\r\n")[0] ?? ""));
      socket.write("CONNECT 127.0.0.1:1 HTTP/1.1\r\nHost: x\r\n\r\n");
    });
    expect(status).toContain("407");
  });

  test("explains when the agent is offline or the target is unreachable", async () => {
    const { proxyUrl, tunnel, connector } = await stack();
    const dead = await targetServer(() => new Response("x"));
    const [host, port] = dead.address.split(":");
    // Close the target so the agent's dial fails.
    dead.stop();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const unreachable = await fetch(`http://${host}:${port}/`, {
      proxy: proxyUrl,
    });
    expect([502, 504]).toContain(unreachable.status);

    tunnel.disconnect(connector.id, "test");
    const offline = await fetch("http://10.0.0.1:80/", { proxy: proxyUrl });
    expect(offline.status).toBe(502);
    expect(await offline.text()).toContain("offline");
  });
});

describe("connection routing", () => {
  test("strips the reserved key and points the host process at the proxy", async () => {
    const { database, proxy } = startStack();
    const { id } = createConnector(database, "Warehouse");
    await proxy.start();
    setConnectorRouting(createConnectorRouting(database, proxy));
    const routed = routeConnection({
      method: "airflow",
      baseUrl: "http://a:8080",
      [CONNECTOR_KEY]: id,
    });
    expect(routed.connection).toEqual({
      method: "airflow",
      baseUrl: "http://a:8080",
    });
    expect(routed.env?.HTTPS_PROXY).toBe(proxy.urlFor(id));
    expect(routed.env?.NO_PROXY).toBe("");
  });

  test("a host process picks the proxy up from its environment alone", async () => {
    const stackInfo = startStack();
    const connector = createConnector(stackInfo.database);
    await stackInfo.proxy.start();
    await fakeAgent(stackInfo.tunnelUrl, connector.token);
    setConnectorRouting(
      createConnectorRouting(stackInfo.database, stackInfo.proxy),
    );
    const target = await targetAddress(
      () => new Response("reached through the agent"),
    );
    const routed = routeConnection({ [CONNECTOR_KEY]: connector.id });

    // Same mechanism the adapter host uses: no proxy option, only environment.
    const child = Bun.spawn(
      [
        "bun",
        "-e",
        `console.log(await (await fetch("http://${target}/")).text())`,
      ],
      {
        env: { ...process.env, ...routed.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect((await new Response(child.stdout).text()).trim()).toBe(
      "reached through the agent",
    );
    await child.exited;
  });

  test("an unmodified adapter reaches a private target through its host process", async () => {
    const stackInfo = startStack();
    const connector = createConnector(stackInfo.database);
    await stackInfo.proxy.start();
    await fakeAgent(stackInfo.tunnelUrl, connector.token);
    setConnectorRouting(
      createConnectorRouting(stackInfo.database, stackInfo.proxy),
    );
    const target = await targetAddress(() => new Response("private data"));

    const host = new AdapterHostClient({
      command: process.execPath,
      args: [
        new URL("../src/adapter-host.ts", import.meta.url).pathname,
        "--bundle",
        new URL("./fixtures/fetch-adapter.ts", import.meta.url).pathname,
      ],
      timeoutMs: 10_000,
    });
    cleanups.push(() => host.close());

    // This is what RemoteBackend does for a service saved "Via DSUI Agent".
    const routed = routeConnection({
      method: "direct",
      url: `http://${target}/`,
      [CONNECTOR_KEY]: connector.id,
    });
    const result = (await host.request({
      method: "resource",
      target: "read",
      input: {},
      persistenceNamespace: "svc-1",
      connection: routed.connection,
      ...(routed.env ? { env: routed.env } : {}),
    })) as { data: { status: number; body: string } };
    expect(result.data).toEqual({ status: 200, body: "private data" });

    // Without routing the same address is not reachable from the adapter alone.
    const direct = (await host
      .request({
        method: "resource",
        target: "read",
        input: {},
        persistenceNamespace: "svc-2",
        connection: { method: "direct", url: "http://unreachable.invalid:81/" },
      })
      .catch((error: Error) => error)) as Error | { data: unknown };
    expect(direct instanceof Error).toBe(true);
  }, 30_000);

  test("leaves direct connections untouched", () => {
    const connection = { method: "airflow", baseUrl: "http://a:8080" };
    expect(routeConnection(connection)).toEqual({ connection });
  });

  test("fails clearly for a deleted or revoked agent", async () => {
    const { database, proxy } = startStack();
    await proxy.start();
    setConnectorRouting(createConnectorRouting(database, proxy));
    expect(() =>
      routeConnection({ [CONNECTOR_KEY]: "gone-gone-gone" }),
    ).toThrow(/no longer exists/);
    const { id } = createConnector(database, "Old");
    database.revokeConnector(id);
    expect(() => routeConnection({ [CONNECTOR_KEY]: id })).toThrow(/revoked/);
  });
});

// Runs the real Go agent against this server. Set DSUI_AGENT_BIN to its path.
describe.skipIf(!process.env.DSUI_AGENT_BIN)(
  "with the real dsui-agent binary",
  () => {
    test("flow control moves megabytes in both directions", async () => {
      const { database, tunnelUrl, proxy } = startStack();
      const { id, token } = createConnector(database);
      await proxy.start();
      const target = await targetAddress(async (request) => {
        const body = new Uint8Array(await request.arrayBuffer());
        const out = new Uint8Array(3 * 1024 * 1024).fill(7);
        return new Response(out, {
          headers: { "x-received": String(body.length) },
        });
      });

      const agent: ChildProcess = spawn(process.env.DSUI_AGENT_BIN as string, [
        "run",
        "--url",
        tunnelUrl
          .replace("/api/v1/connectors/tunnel", "")
          .replace("ws://", "http://"),
        "--token",
        token,
        "--targets",
        target,
        "--log-level",
        "warn",
      ]);
      cleanups.push(() => void agent.kill());
      const deadline = Date.now() + 10_000;
      while (
        !database.getConnector(id)?.last_connected_at &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 50));

      const upload = new Uint8Array(2 * 1024 * 1024).fill(1);
      const response = await fetch(`http://${target}/`, {
        method: "POST",
        body: upload,
        proxy: proxy.urlFor(id),
      });
      const body = new Uint8Array(await response.arrayBuffer());
      expect(response.headers.get("x-received")).toBe(String(upload.length));
      expect(body.length).toBe(3 * 1024 * 1024);
      expect(body.every((byte) => byte === 7)).toBe(true);
    }, 30_000);

    test("the agent refuses targets outside its allowlist", async () => {
      const { database, tunnelUrl, proxy } = startStack();
      const { id, token } = createConnector(database);
      await proxy.start();
      const allowed = await targetAddress(() => new Response("ok"));
      const forbidden = await targetAddress(() => new Response("secret"));
      const agent = spawn(process.env.DSUI_AGENT_BIN as string, [
        "run",
        "--url",
        tunnelUrl
          .replace("/api/v1/connectors/tunnel", "")
          .replace("ws://", "http://"),
        "--token",
        token,
        "--targets",
        allowed,
        "--log-level",
        "error",
      ]);
      cleanups.push(() => void agent.kill());
      const deadline = Date.now() + 10_000;
      while (
        !database.getConnector(id)?.last_connected_at &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 50));

      const ok = await fetch(`http://${allowed}/`, { proxy: proxy.urlFor(id) });
      expect(await ok.text()).toBe("ok");
      const refused = await fetch(`http://${forbidden}/`, {
        proxy: proxy.urlFor(id),
      });
      expect(refused.status).toBe(403);
    }, 30_000);
  },
);

describe("connector API", () => {
  function api() {
    const s = startStack();
    const app = new Hono();
    app.use("*", async (context, next) => {
      context.set("principal", { id: "tester", role: "owner" });
      await next();
    });
    registerConnectorRoutes(app, {
      database: s.database,
      cipher: undefined,
      tunnel: s.tunnel,
      audit: (actor, action, target) => s.database.audit(actor, action, target),
    });
    const call = (method: string, path: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    return { ...s, call };
  }

  test("creating returns the token once and never lists it again", async () => {
    const { call } = api();
    const created = await call("POST", "/api/v1/connectors", {
      name: "  DC 1 ",
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      token: string;
      connector: { id: string; name: string };
    };
    expect(body.token).toMatch(/^dsa_/);
    expect(body.connector.name).toBe("DC 1");

    const listed = JSON.stringify(
      await (await call("GET", "/api/v1/connectors")).json(),
    );
    expect(listed).not.toContain(body.token);
    expect(listed).not.toContain("token_hash");
  });

  test("rotating invalidates the old token and the new one connects", async () => {
    const { call, tunnelUrl } = api();
    const created = (await (
      await call("POST", "/api/v1/connectors", { name: "a" })
    ).json()) as {
      token: string;
      connector: { id: string };
    };
    const rotated = (await (
      await call("POST", `/api/v1/connectors/${created.connector.id}/rotate`)
    ).json()) as { token: string };
    expect(rotated.token).not.toBe(created.token);
    const probe = (token: string) =>
      fetch(tunnelUrl.replace("ws://", "http://"), {
        headers: { Authorization: `Bearer ${token}` },
      });
    expect((await probe(created.token)).status).toBe(401);
    await fakeAgent(tunnelUrl, rotated.token);
  });

  test("revoked agents are refused and flagged", async () => {
    const { call, tunnelUrl } = api();
    const created = (await (
      await call("POST", "/api/v1/connectors", { name: "a" })
    ).json()) as {
      token: string;
      connector: { id: string };
    };
    const revoked = (await (
      await call("POST", `/api/v1/connectors/${created.connector.id}/revoke`)
    ).json()) as { revokedAt: string | null };
    expect(revoked.revokedAt).not.toBeNull();
    const response = await fetch(tunnelUrl.replace("ws://", "http://"), {
      headers: { Authorization: `Bearer ${created.token}` },
    });
    expect(response.status).toBe(401);
  });

  test("test-target reports success, a refusal and an offline agent", async () => {
    const { call, tunnelUrl } = api();
    const created = (await (
      await call("POST", "/api/v1/connectors", { name: "a" })
    ).json()) as {
      token: string;
      connector: { id: string };
    };
    const path = `/api/v1/connectors/${created.connector.id}/test-target`;

    const offline = (await (
      await call("POST", path, { target: "127.0.0.1:1" })
    ).json()) as { ok: boolean; code: string };
    expect(offline).toMatchObject({ ok: false, code: "offline" });

    await fakeAgent(tunnelUrl, created.token);
    const target = await targetAddress(() => new Response("x"));
    const good = (await (await call("POST", path, { target })).json()) as {
      ok: boolean;
    };
    expect(good.ok).toBe(true);
    const refused = (await (
      await call("POST", path, { target: "127.0.0.1:1" })
    ).json()) as { ok: boolean; code: string };
    expect(refused).toMatchObject({ ok: false, code: "unreachable" });
    expect(
      (await call("POST", path, { target: "not a target" })).status,
    ).toBeGreaterThanOrEqual(400);
  });

  test("validates names", async () => {
    const { call } = api();
    expect(
      (await call("POST", "/api/v1/connectors", { name: "   " })).status,
    ).toBeGreaterThanOrEqual(400);
  });
});
