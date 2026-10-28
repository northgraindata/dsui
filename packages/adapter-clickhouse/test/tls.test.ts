import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClickHouseClient } from "../src/client";
import { connectionSchema } from "../src/config";

test("verified TLS and client certificates work directly and through CONNECT", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dsui-clickhouse-tls-"));
  const keyPath = join(directory, "key.pem");
  const certPath = join(directory, "cert.pem");
  const generated = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
  expect(generated.exitCode).toBe(0);
  const cert = readFileSync(certPath, "utf8");
  const key = readFileSync(keyPath, "utf8");
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    tls: { cert, key, ca: cert, requestCert: true, rejectUnauthorized: true },
    fetch: () =>
      new Response('{"meta":[{"name":"ok","type":"UInt8"}],"data":[[1]]}'),
  });
  let tunnels = 0;
  const proxy = createServer();
  proxy.on("connect", (request, socket, head) => {
    tunnels++;
    const target = new URL(`http://${request.url}`);
    const upstream = connect(Number(target.port), target.hostname, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const address = proxy.address();
  if (!address || typeof address === "string")
    throw new Error("Missing proxy port");
  const config = connectionSchema.parse({
    method: "url",
    url: `https://127.0.0.1:${server.port}`,
    caCert: cert,
    clientCert: cert,
    clientKey: key,
    compression: false,
  });
  try {
    for (const proxyUrl of [undefined, `http://127.0.0.1:${address.port}`]) {
      const client = createClickHouseClient({ ...config, proxyUrl });
      try {
        expect((await client.execute("SELECT 1")).rows[0]?.ok).toBe(1);
      } finally {
        await client.dispose();
      }
    }
    expect(tunnels).toBe(1);
    const untrusted = createClickHouseClient({ ...config, caCert: undefined });
    try {
      await expect(untrusted.execute("SELECT 1")).rejects.toThrow();
    } finally {
      await untrusted.dispose();
    }
  } finally {
    server.stop(true);
    proxy.closeAllConnections();
    proxy.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15_000);
