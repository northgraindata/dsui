import { afterEach, describe, expect, test } from "bun:test";
import { dashboardLink, shareDashboard } from "../src/actions/share.js";
import { createShaperClient } from "../src/client.js";

let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(() => {
  server?.stop(true);
  server = undefined;
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Mirrors Shaper: sharing routes accept only a signed-in user's token. */
function fakeShaper() {
  const calls: { path: string; auth: string | null; body: unknown }[] = [];
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      const auth = request.headers.get("authorization");
      const body = request.method === "POST" ? await request.json() : undefined;
      calls.push({ path, auth, body });
      if (path === "/api/login") return json({ token: "session" });
      if (path === "/api/auth/token") return json({ jwt: "user-jwt" });
      if (path.startsWith("/api/dashboards/")) {
        if (auth !== "Bearer user-jwt")
          return json({ error: "Unauthorized" }, 401);
        return json({ ok: true });
      }
      return json({}, 404);
    },
  });
  return { calls, baseUrl: `http://127.0.0.1:${server.port}/` };
}

const KEY = "shaperkey.id.secret";

describe("shareDashboard client", () => {
  test("signs in as the user, then sets password before visibility", async () => {
    const { calls, baseUrl } = fakeShaper();
    const client = createShaperClient({
      baseUrl,
      apiKey: KEY,
      userEmail: "a@b.c",
      userPassword: "pw",
    });
    await client.shareDashboard("d1", {
      visibility: "password-protected",
      password: "hunter2hunter2",
    });
    expect(calls.map((call) => call.path)).toEqual([
      "/api/login",
      "/api/auth/token",
      "/api/dashboards/d1/password",
      "/api/dashboards/d1/visibility",
    ]);
    expect(calls[0]?.body).toEqual({ email: "a@b.c", password: "pw" });
    expect(calls[1]?.body).toEqual({ token: "session" });
    expect(calls[3]?.body).toEqual({ visibility: "password-protected" });
  });

  test("explains that sharing needs a Shaper user when none is set", async () => {
    const { baseUrl } = fakeShaper();
    const client = createShaperClient({ baseUrl, apiKey: KEY });
    expect(client.canShare).toBe(false);
    await expect(
      client.shareDashboard("d1", { visibility: "public" }),
    ).rejects.toThrow("needs a Shaper user");
  });

  test("requires a password for password-protected sharing", async () => {
    const { calls, baseUrl } = fakeShaper();
    const client = createShaperClient({
      baseUrl,
      apiKey: KEY,
      userEmail: "a@b.c",
      userPassword: "pw",
    });
    await expect(
      client.shareDashboard("d1", { visibility: "password-protected" }),
    ).rejects.toThrow("password is required");
    expect(calls).toHaveLength(0);
  });
});

describe("share-dashboard action", () => {
  function ctx(sharing = { public: true, password: true }) {
    const shared: unknown[] = [];
    return {
      shared,
      value: {
        config: { baseUrl: "https://shaper.example/sub/" },
        signal: new AbortController().signal,
        invalidate: () => undefined,
        client: {
          getSystemConfig: async () => ({
            publicSharingEnabled: sharing.public,
            passwordProtectedSharingEnabled: sharing.password,
          }),
          shareDashboard: async (...args: unknown[]) => {
            shared.push(args.slice(0, 2));
          },
        },
      } as never,
    };
  }

  test("generates and returns a password once when none is given", async () => {
    const { shared, value } = ctx();
    const result = (await shareDashboard.definition.run(
      { id: "d1", visibility: "password-protected" },
      value,
    )) as { url: string; generatedPassword: string };
    expect(result.url).toBe("https://shaper.example/sub/dashboards/d1");
    expect(result.generatedPassword.length).toBeGreaterThanOrEqual(16);
    expect(shared[0]).toEqual([
      "d1",
      { visibility: "password-protected", password: result.generatedPassword },
    ]);
  });

  test("does not echo a password the user chose", async () => {
    const { value } = ctx();
    const result = await shareDashboard.definition.run(
      { id: "d1", visibility: "password-protected", password: "chosen-pass" },
      value,
    );
    expect(result).not.toHaveProperty("generatedPassword");
  });

  test("makes a dashboard private without a link", async () => {
    const { value } = ctx();
    expect(
      await shareDashboard.definition.run(
        { id: "d1", visibility: "private" },
        value,
      ),
    ).toEqual({
      id: "d1",
      visibility: "private",
      navigation: [{ label: "Open dashboard in DSUI", path: "/dashboards/d1" }],
    });
  });

  test("refuses modes the server has disabled", async () => {
    const { value } = ctx({ public: false, password: false });
    await expect(
      shareDashboard.definition.run({ id: "d1", visibility: "public" }, value),
    ).rejects.toThrow("Public sharing is disabled");
  });

  test("builds the link under a path prefix", () => {
    expect(dashboardLink("https://x.dev/shaper", "a b")).toBe(
      "https://x.dev/shaper/dashboards/a%20b",
    );
  });
});
