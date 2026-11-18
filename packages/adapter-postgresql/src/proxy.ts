import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";

const HEADER_END = "\r\n\r\n";
const MAX_RESPONSE_BYTES = 8 * 1024;
const STATUS_LINE = /^HTTP\/1\.[01] (\d{3})/;
const MS_PER_SECOND = 1000;

function proxyAuthHeader(proxy: URL): string {
  if (!(proxy.username || proxy.password)) return "";
  const user = decodeURIComponent(proxy.username);
  const password = decodeURIComponent(proxy.password);
  const token = Buffer.from(`${user}:${password}`).toString("base64");
  return `Proxy-Authorization: Basic ${token}\r\n`;
}

function readAvailable(socket: Socket): string {
  let text = "";
  let chunk: Buffer | null = socket.read();
  while (chunk !== null) {
    text += chunk.toString("latin1");
    chunk = socket.read();
  }
  return text;
}

/**
 * Opens a TCP tunnel to `host:port` through an HTTP CONNECT proxy, such as the
 * DSUI Agent. The postgres driver resolves hostnames itself, so private names
 * only work when the proxy resolves them.
 */
export function connectThroughProxy(
  proxyUrl: string,
  host: string,
  port: number,
  timeoutSeconds: number,
): Promise<Socket> {
  const proxy = new URL(proxyUrl);
  const secure = proxy.protocol === "https:";
  const proxyPort = Number(proxy.port) || (secure ? 443 : 80);

  return new Promise((resolve, reject) => {
    const socket: Socket = secure
      ? tlsConnect({ host: proxy.hostname, port: proxyPort })
      : netConnect({ host: proxy.hostname, port: proxyPort });
    let received = "";

    const fail = (error: Error) => {
      clearTimeout(timer);
      socket.destroy();
      reject(error);
    };
    const timer = setTimeout(
      () => fail(new Error(`Proxy tunnel to ${host}:${port} timed out`)),
      timeoutSeconds * MS_PER_SECOND,
    );
    const onReadable = () => {
      received += readAvailable(socket);
      const end = received.indexOf(HEADER_END);
      if (end === -1) {
        if (received.length > MAX_RESPONSE_BYTES) {
          fail(new Error("Proxy returned an oversized CONNECT response"));
        }
        return;
      }
      clearTimeout(timer);
      socket.off("readable", onReadable);
      socket.off("error", fail);
      const status = Number(STATUS_LINE.exec(received)?.[1]);
      if (status !== 200) {
        fail(
          new Error(
            `Proxy refused the tunnel to ${host}:${port} (HTTP ${status || "?"})`,
          ),
        );
        return;
      }
      // Bytes after the headers belong to the database; hand them back.
      const rest = Buffer.from(
        received.slice(end + HEADER_END.length),
        "latin1",
      );
      if (rest.length > 0) socket.unshift(rest);
      resolve(socket);
    };

    socket.on("readable", onReadable);
    socket.once("error", fail);
    socket.once(secure ? "secureConnect" : "connect", () => {
      const auth = proxyAuthHeader(proxy);
      socket.write(
        `CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}\r\n`,
      );
    });
  });
}
