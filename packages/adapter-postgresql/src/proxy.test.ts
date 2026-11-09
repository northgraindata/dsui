import { describe, expect, it } from "bun:test";
import { createServer } from "node:net";
import { connectThroughProxy } from "./proxy.js";

function startProxy(reply: string, trailing = "") {
  const requests: string[] = [];
  const server = createServer((socket) => {
    socket.once("data", (data) => {
      requests.push(data.toString());
      socket.write(reply + trailing);
    });
  });
  return new Promise<{ url: string; requests: string[]; close: () => void }>(
    (resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        resolve({
          url: `http://127.0.0.1:${port}`,
          requests,
          close: () => server.close(),
        });
      });
    },
  );
}

describe("connectThroughProxy", () => {
  it("sends CONNECT for the private host and keeps bytes after the headers", async () => {
    const proxy = await startProxy("HTTP/1.1 200 OK\r\n\r\n", "N");
    const socket = await connectThroughProxy(proxy.url, "postgres", 5432, 5);
    const first = await new Promise<Buffer>((resolve) =>
      socket.once("data", resolve),
    );
    expect(proxy.requests[0]).toContain("CONNECT postgres:5432 HTTP/1.1");
    expect(first.toString()).toBe("N");
    socket.destroy();
    proxy.close();
  });

  it("rejects when the proxy refuses the tunnel", async () => {
    const proxy = await startProxy("HTTP/1.1 403 Forbidden\r\n\r\n");
    await expect(
      connectThroughProxy(proxy.url, "postgres", 5432, 5),
    ).rejects.toThrow("HTTP 403");
    proxy.close();
  });
});
