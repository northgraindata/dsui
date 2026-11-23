import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "@northgraindata/dsui-adapter-sdk";
import { AdapterHostClient } from "../src/adapters/host";
import { RemoteBackend } from "../src/adapters/loader";
import { createRuntime } from "../src/app";
import fixture from "./fixtures/catalog-adapter";

const bundle = new URL("./fixtures/catalog-adapter.ts", import.meta.url)
  .pathname;

test("the HTTP catalog preserves community presentation metadata and executable connection methods", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dsui-catalog-"));
  const runtime = createRuntime({
    dataDir: directory,
    config: {
      services: [],
    },
  });
  try {
    await runtime.refreshConfig();
    const host = new AdapterHostClient({
      command: process.execPath,
      args: [
        new URL("../src/adapter-host.ts", import.meta.url).pathname,
        "--bundle",
        bundle,
      ],
      timeoutMs: 10_000,
    });
    const described = z
      .object({
        connectionMethods: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            requestConcurrency: z.enum(["parallel", "serial"]),
            contextIdleTimeoutMs: z.number(),
            schema: z.record(z.unknown()),
          }),
        ),
      })
      .parse(await host.request({ method: "describe" }));
    runtime.registry.register({
      id: fixture.metadata.id,
      metadata: fixture.metadata,
      connectionMethods: described.connectionMethods,
      catalog: {
        resources: [],
        actions: [],
        pages: [],
        components: [],
        jobs: [],
        signals: [],
        routes: [],
      },
      backend: new RemoteBackend(host, fixture.metadata.id, []),
    });
    const response = await runtime.app.request("/api/v1/adapters");
    expect(response.status).toBe(200);
    const adapters = await response.json();
    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toMatchObject({
      id: "catalog-fixture",
      name: "Community database",
      version: "1.2.3",
      author: "Community maintainer",
      status: "ok",
      presentation: fixture.metadata.presentation,
    });
    expect(adapters[0].connectionMethods[0]).toMatchObject({
      id: "api",
      label: "API endpoint",
    });
    expect(adapters[0].connectionMethods[0].schema.required).toEqual(["url"]);
  } finally {
    await runtime.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("the isolated adapter host describes optional presentation metadata without losing it", async () => {
  const host = new AdapterHostClient({
    command: process.execPath,
    args: [
      new URL("../src/adapter-host.ts", import.meta.url).pathname,
      "--bundle",
      bundle,
    ],
    timeoutMs: 10_000,
  });
  try {
    const description = await host.request({ method: "describe" });
    expect(description).toMatchObject({
      metadata: { presentation: fixture.metadata.presentation },
    });
  } finally {
    await host.close();
  }
});
