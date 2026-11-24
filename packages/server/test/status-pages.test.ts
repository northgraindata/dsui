import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineAction, definePlugin, z } from "@northgraindata/dsui-plugin-sdk";
import health from "../../plugin-health/src/plugin";
import statusPages from "../../plugin-status-pages/src/plugin";
import { createRuntime } from "../src/app";

for (const withHealth of [false, true]) {
  test(`Status pages accepts notices with Health ${withHealth ? "enabled" : "absent"}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "dsui-status-pages-"));
    const consumer = definePlugin({
      metadata: {
        id: "consumer",
        name: "Consumer",
        version: "1.0.0",
        apiVersion: 1,
      },
      configSchema: z.object({}),
      setup(registry) {
        registry.action(
          defineAction({
            id: "exercise",
            input: z.object({}),
            permission: "manage",
            run: async (_input, ctx) => {
              const created = z
                .object({ id: z.string() })
                .parse(
                  await ctx.plugins.executeAction(
                    "status-pages",
                    "create-status-page",
                    { slug: "operations", name: "Operations", components: [] },
                  ),
                );
              const notice = z.object({ id: z.string() }).parse(
                await ctx.plugins.executeAction("status-pages", "post-notice", {
                  pageId: created.id,
                  title: "Delayed loads",
                  impact: "degraded",
                  message: "Investigating.",
                  source: "consumer",
                }),
              );
              const posted = await ctx.plugins.queryResource(
                "status-pages",
                "status-page",
                { slug: "operations" },
              );
              await ctx.plugins.executeAction(
                "status-pages",
                "resolve-notice",
                { noticeId: notice.id, message: "Recovered." },
              );
              return {
                posted,
                resolved: await ctx.plugins.queryResource(
                  "status-pages",
                  "status-page",
                  { slug: "operations" },
                ),
                catalog: await ctx.plugins.list(),
              };
            },
          }),
        );
      },
    });
    const runtime = createRuntime({
      dataDir: join(root, "state"),
      config: {
        services: [],
        plugins: {
          "status-pages": { package: "status-test", enabled: true, config: {} },
          consumer: { package: "consumer-test", enabled: true, config: {} },
          ...(withHealth
            ? { health: { package: "health-test", enabled: true, config: {} } }
            : {}),
        },
      },
      pluginModuleLoader: async (specifier) => ({
        default:
          specifier === "status-test"
            ? statusPages
            : specifier === "health-test"
              ? health
              : consumer,
      }),
    });
    try {
      await runtime.refreshConfig();
      const response = await runtime.app.request(
        "/api/v1/plugins/consumer/procedures/exercise",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      const body = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(200);
      expect(body.data.posted.healthAvailable).toBe(withHealth);
      expect(body.data.posted.active[0].title).toBe("Delayed loads");
      expect(body.data.resolved.active).toHaveLength(0);
      expect(body.data.resolved.history[0].status).toBe("resolved");
      expect(
        body.data.catalog.find(
          (item: { id: string }) => item.id === "status-pages",
        ).iconUrl,
      ).toStartWith("data:image/webp");
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}
