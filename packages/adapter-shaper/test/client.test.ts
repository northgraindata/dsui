import { afterEach, describe, expect, test } from "bun:test";
import { createShaperClient, normalizeBaseUrl } from "../src/client.js";

const KEY = "shaperkey.id.secret";
let server: ReturnType<typeof Bun.serve> | undefined;

function start(handler: (request: Request) => Response | Promise<Response>) {
  server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handler });
  return createShaperClient({
    baseUrl: `http://127.0.0.1:${server.port}/`,
    apiKey: KEY,
  });
}

afterEach(() => {
  server?.stop(true);
  server = undefined;
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("normalizeBaseUrl", () => {
  test("strips api paths, query and trailing slashes", () => {
    expect(normalizeBaseUrl("https://x.dev/shaper/api/apps?a=1").href).toBe(
      "https://x.dev/shaper/",
    );
    expect(normalizeBaseUrl("https://x.dev").href).toBe("https://x.dev/");
  });
});

describe("client", () => {
  test("sends the API key as a bearer token", async () => {
    const seen: { authorization: string | null } = { authorization: null };
    const client = start((request) => {
      seen.authorization = request.headers.get("authorization");
      return json({ databases: [] });
    });
    await client.getSchema();
    expect(seen.authorization).toBe(`Bearer ${KEY}`);
  });

  test("pages through apps until a short page", async () => {
    const offsets: string[] = [];
    const client = start((request) => {
      const url = new URL(request.url);
      offsets.push(url.searchParams.get("offset") ?? "");
      const count = url.searchParams.get("offset") === "0" ? 200 : 3;
      return json({
        apps: Array.from({ length: count }, (_, index) => ({
          id: `${url.searchParams.get("offset")}-${index}`,
          type: "dashboard",
          path: "/",
          name: "d",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        })),
      });
    });
    expect(await client.listApps()).toHaveLength(203);
    expect(offsets).toEqual(["0", "200"]);
  });

  test("maps permission and authentication failures", async () => {
    const forbidden = start(() =>
      json({ error: "Missing required permission" }, 403),
    );
    await expect(forbidden.getSchema()).rejects.toThrow(
      "lacks a required permission",
    );
    server?.stop(true);
    const rejected = start(() => json({ error: "Unauthorized" }, 401));
    await expect(rejected.getSchema()).rejects.toThrow("rejected the API key");
  });

  test("parses SQL results from CSV", async () => {
    const client = start(
      () =>
        new Response('a,b\n1,"x,y"\n', {
          headers: { "content-type": "text/csv" },
        }),
    );
    expect(await client.runSql("select 1")).toEqual({
      columns: ["a", "b"],
      rows: [["1", "x,y"]],
      truncated: false,
    });
  });

  test("mints a dashboard-scoped token before reading a dashboard", async () => {
    const calls: string[] = [];
    const client = start(async (request) => {
      const url = new URL(request.url);
      calls.push(`${request.method} ${url.pathname}${url.search}`);
      if (url.pathname === "/api/auth/token") {
        expect(await request.json()).toEqual({
          token: KEY,
          dashboardId: "d1",
          variables: { region: "eu" },
        });
        return json({ jwt: "jwt-1" });
      }
      expect(request.headers.get("authorization")).toBe("Bearer jwt-1");
      return json({ name: "", sections: [] });
    });
    await client.getDashboard("d1", { region: "eu" });
    expect(calls).toEqual([
      "POST /api/auth/token",
      "GET /api/dashboards/d1?region=eu",
    ]);
  });

  test("resolves the one-time download URL against the server", async () => {
    const client = start(() =>
      json({ url: "/api/download/abc/dashboard.pdf" }),
    );
    expect(await client.requestDownloadUrl("d1", "dashboard.pdf")).toBe(
      `http://127.0.0.1:${server?.port}/api/download/abc/dashboard.pdf`,
    );
  });

  test("refuses redirects instead of following them", async () => {
    const client = start(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://example.com/" },
        }),
    );
    await expect(client.getSchema()).rejects.toThrow();
  });

  test("aborts requests after dispose", async () => {
    const client = start(() => json({ databases: [] }));
    client.dispose();
    await expect(client.getSchema()).rejects.toThrow();
  });
});
