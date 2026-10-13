import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { registerSystemRoutes } from "../src/routes/system";

test("absolute web roots serve the SPA for nested query deep links", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-web-"));
  try {
    await writeFile(join(directory, "index.html"), "<title>Workspace</title>");
    const app = new Hono();
    registerSystemRoutes(app, { webRoot: directory });
    app.get("/api/v1/services", (context) => context.json({ services: [] }));
    const response = await app.request(
      "/services/warehouse/query?sql=SELECT%201",
    );
    expect(response.status).toBe(200);
    expect(await (await app.request("/api/v1/services")).json()).toEqual({
      services: [],
    });
    expect((await app.request("/api/v1/unknown")).status).toBe(404);
    expect(await response.text()).toContain("<title>Workspace</title>");
    expect(
      (await app.request("/api/v1/health")).headers.get("Content-Type"),
    ).toContain("application/json");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
