import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCodeRepositoryPlugin } from "@northgraindata/dsui-plugin-code-repository";
import { definePlugin, z } from "@northgraindata/dsui-plugin-sdk";
import { createRuntime } from "../src/app";

async function until(check: () => Promise<boolean>) {
  const deadline = Date.now() + 5000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Repository job did not finish");
    await Bun.sleep(30);
  }
}
test("configure, queue, browse, refresh, authorize and restore repository snapshots through HTTP", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-repository-integration-"));
  const codeDir = join(root, "code");
  await mkdir(codeDir);
  const code = join(codeDir, "app.tsx");
  await writeFile(code, "export const one = 1;\n");
  await writeFile(join(codeDir, "binary.bin"), new Uint8Array([0, 1, 2]));
  await writeFile(join(codeDir, "large.txt"), "x".repeat(1024 * 1024 + 1));
  await writeFile(
    join(codeDir, "space # +.tsx"),
    "export const special = true;",
  );
  await Bun.build({
    entrypoints: [
      join(import.meta.dir, "../../plugin-code-repository/src/browser.tsx"),
    ],
    target: "browser",
    outdir: root,
    naming: "browser.mjs",
  });
  let role: "owner" | "viewer" = "owner";
  const security = definePlugin({
    metadata: {
      id: "security",
      name: "Access",
      version: "1.0.0",
      apiVersion: 1,
      security: true,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.authentication({
        authenticate: () => ({ id: "operator", role }),
      });
      registry.authorization({
        authorize: ({ resource }) => resource?.id !== "restricted",
      });
    },
  });
  const loadModule = async (specifier: string) => ({
    default:
      specifier === "security-test" ? security : createCodeRepositoryPlugin(),
  });
  const config = {
    services: [
      { id: "retail", adapter: "absent", name: "Retail", connection: {} },
      { id: "other", adapter: "absent", connection: {} },
      { id: "restricted", adapter: "absent", connection: {} },
    ],
    plugins: {
      security: {
        package: "security-test",
        enabled: true,
        critical: true,
        config: {},
      },
      "code-repository": {
        package: "fixture",
        browserBundle: join(root, "browser.mjs"),
        enabled: true,
        config: { localRoots: [codeDir], githubToken: "do-not-disclose" },
      },
    },
  };
  let runtime = createRuntime({
    dataDir: join(root, "state"),
    config,
    pluginModuleLoader: loadModule,
  });
  const call = (kind: string, id: string, input: unknown) =>
    runtime.app.request(`/api/v1/plugins/code-repository/${kind}/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  try {
    await runtime.refreshConfig();
    const saved = await call("procedures", "save", {
      serviceId: "retail",
      name: "Local code",
      provider: "local",
      repository: codeDir,
      instructions: "Retail application",
      refreshMinutes: 15,
    });
    expect(saved.status).toBe(200);
    const result = z
      .object({ data: z.object({ id: z.string() }) })
      .parse(await saved.json());
    const locator = { serviceId: "retail", connectionId: result.data.id };
    await until(
      async () =>
        z
          .object({
            data: z.object({ connection: z.object({ status: z.string() }) }),
          })
          .parse(await (await call("resources", "tree", locator)).json()).data
          .connection.status === "ready",
    );
    const file = await call("resources", "file", {
      ...locator,
      path: "app.tsx",
    });
    expect(JSON.stringify(await file.json())).toContain("export const one = 1");
    const binary = z
      .object({ data: z.object({ content: z.null(), reason: z.string() }) })
      .parse(
        await (
          await call("resources", "file", { ...locator, path: "binary.bin" })
        ).json(),
      );
    expect(binary.data.reason).toBe("Binary file");
    const large = z
      .object({ data: z.object({ content: z.null(), size: z.number() }) })
      .parse(
        await (
          await call("resources", "file", { ...locator, path: "large.txt" })
        ).json(),
      );
    expect(large.data.size).toBe(1024 * 1024 + 1);
    expect(
      (
        await call("resources", "file", {
          ...locator,
          serviceId: "restricted",
          path: "app.tsx",
        })
      ).status,
    ).toBe(403);
    const specialRoute = `services/retail/connections/${result.data.id}/files/${encodeURIComponent("space # +.tsx")}`;
    expect(
      JSON.stringify(
        await (
          await runtime.app.request(
            `/api/v1/plugins/code-repository/pages/${encodeURIComponent(specialRoute)}`,
          )
        ).json(),
      ),
    ).toContain('"path":"space # +.tsx"');

    expect(
      runtime.signalBus.list({ signalId: "code-repository.updated" }),
    ).toHaveLength(1);
    const route = `services/retail/connections/${result.data.id}/files/app.tsx`;
    const page = await runtime.app.request(
      `/api/v1/plugins/code-repository/pages/${encodeURIComponent(route)}`,
    );
    expect(page.status).toBe(200);
    expect(JSON.stringify(await page.json())).toContain('"path":"app.tsx"');
    const overview = await call("resources", "overview", {});
    const publicData = JSON.stringify(await overview.json());
    expect(publicData).toContain("Retail application");
    expect(publicData).not.toContain("do-not-disclose");
    expect(publicData).not.toContain("restricted");
    expect(
      (
        await call("resources", "file", {
          ...locator,
          serviceId: "other",
          path: "app.tsx",
        })
      ).status,
    ).toBe(404);
    role = "viewer";
    expect((await call("procedures", "refresh", locator)).status).toBe(403);
    expect(
      (await call("resources", "file", { ...locator, path: "app.tsx" })).status,
    ).toBe(200);
    role = "owner";
    const first = await call("procedures", "refresh", locator);
    const second = await call("procedures", "refresh", locator);
    expect(await first.json()).toEqual(await second.json());
    await until(
      async () =>
        !runtime.database.sqlite
          .query(
            "SELECT 1 FROM plugin_job_runs WHERE job_id = 'sync' AND status IN ('queued','running')",
          )
          .get(),
    );
    expect(
      runtime.signalBus.list({ signalId: "code-repository.updated" }),
    ).toHaveLength(1);
    await writeFile(code, "export const two = 2;\n");
    const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60000);
    try {
      const scheduler = runtime.pluginRuntime
        .jobs()
        .find(({ job }) => job.id === "schedule-refresh");
      if (!scheduler) throw new Error("Refresh scheduler was not registered");
      await scheduler.job.invoke(null, {
        runId: "schedule-check",
        signal: new AbortController().signal,
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
        reportSideEffect: () => undefined,
      });
    } finally {
      clock.mockRestore();
    }
    await until(async () =>
      JSON.stringify(
        await (
          await call("resources", "file", { ...locator, path: "app.tsx" })
        ).json(),
      ).includes("export const two = 2"),
    );
    expect(
      runtime.signalBus.list({ signalId: "code-repository.updated" }),
    ).toHaveLength(2);
    const secondConnection = await call("procedures", "save", {
      serviceId: "retail",
      name: "Another attachment",
      provider: "local",
      repository: codeDir,
      refreshMinutes: 0,
    });
    const secondId = z
      .object({ data: z.object({ id: z.string() }) })
      .parse(await secondConnection.json()).data.id;
    const overviewWithTwo = z
      .object({
        data: z.object({
          services: z.array(
            z.object({ id: z.string(), connections: z.array(z.unknown()) }),
          ),
        }),
      })
      .parse(await (await call("resources", "overview", {})).json());
    expect(
      overviewWithTwo.data.services.find((item) => item.id === "retail")
        ?.connections,
    ).toHaveLength(2);
    expect(
      (
        await call("procedures", "remove", {
          serviceId: "retail",
          connectionId: secondId,
        })
      ).status,
    ).toBe(200);
    await rm(codeDir, { recursive: true });
    await call("procedures", "refresh", locator);
    await until(
      async () =>
        z
          .object({
            data: z.object({ connection: z.object({ status: z.string() }) }),
          })
          .parse(await (await call("resources", "tree", locator)).json()).data
          .connection.status === "error",
    );
    expect(
      JSON.stringify(
        await (
          await call("resources", "file", { ...locator, path: "app.tsx" })
        ).json(),
      ),
    ).toContain("export const two = 2");
    await runtime.close();
    runtime = createRuntime({
      dataDir: join(root, "state"),
      config,
      pluginModuleLoader: loadModule,
    });
    await runtime.refreshConfig();
    expect(
      JSON.stringify(
        await (
          await call("resources", "file", { ...locator, path: "app.tsx" })
        ).json(),
      ),
    ).toContain("export const two = 2");
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});
