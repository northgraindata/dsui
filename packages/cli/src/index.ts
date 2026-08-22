#!/usr/bin/env bun
import { join } from "node:path";
import { createRuntime, loadConfig } from "@dsui/server";

const VERSION = "0.1.0";

function usage(): string {
  return `dsui ${VERSION}

Usage:
  dsui [start]
  dsui version
  dsui doctor [--check-adapters] [--resolve-adapter npm:@scope/package@1.2.3]

Connections are managed in the UI or dsui.yaml.`;
}

async function doctor(args: string[]): Promise<number> {
  const configPath = process.env.DSUI_CONFIG;
  try {
    const config = await loadConfig(configPath);
    console.log(`Configuration: ${configPath ?? "not configured"}`);
    console.log(`Services: ${config.services.length}`);
    if (args.includes("--check-adapters")) {
      const runtime = createRuntime({ config, databasePath: ":memory:" });
      for (const service of config.services) {
        try {
          runtime.registry.get(service.adapter);
          console.log(`✓ ${service.id}: ${service.adapter}`);
        } catch {
          console.error(`✗ ${service.id}: unknown adapter ${service.adapter}`);
          runtime.close();
          return 1;
        }
      }
      runtime.close();
    }
    const target = args.indexOf("--resolve-adapter");
    if (target !== -1) {
      const specifier = args[target + 1];
      if (
        !specifier?.startsWith("npm:") ||
        !/@.+@\d+\.\d+\.\d+/.test(specifier)
      )
        throw new Error(
          "--resolve-adapter requires npm:@scope/package@exact-version",
        );
      console.log(
        `Adapter resolution is review-only; pin ${specifier.slice(4)} with its npm SHA-512 integrity in dsui.yaml.`,
      );
    }
    console.log("Doctor: OK");
    return 0;
  } catch (error) {
    console.error(
      `Doctor: ${error instanceof Error ? error.message : "failed"}`,
    );
    return 1;
  }
}

/** Small newline-delimited JSON protocol used only by the isolated adapter host. */
async function adapterHost(args: string[]): Promise<number> {
  const id = args[args.indexOf("--adapter") + 1];
  if (!id) {
    console.error("adapter-host requires --adapter <id>");
    return 2;
  }
  const runtime = createRuntime({ databasePath: ":memory:" });
  try {
    runtime.registry.get(id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unknown adapter");
    return 1;
  }
  const input = await new Response(Bun.stdin.stream()).text();
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const request = JSON.parse(line) as {
        connection: Record<string, unknown>;
        operation?: string;
        input?: unknown;
      };
      const adapter = runtime.registry.get(id);
      const connection = adapter.connectionSchema.parse(request.connection);
      const instance = adapter.create({}, connection);
      const response = request.operation
        ? {
            data: await instance.execute(
              request.operation,
              request.input ?? {},
            ),
          }
        : await instance.health();
      await instance.close?.();
      console.log(JSON.stringify(response));
    } catch (error) {
      console.log(
        JSON.stringify({
          error: error instanceof Error ? error.message : "adapter host failed",
        }),
      );
    }
  }
  return 0;
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const [command = "start", ...args] = argv;
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  if (command === "doctor") return doctor(args);
  if (command === "adapter-host") return adapterHost(args);
  if (command !== "start") {
    console.error(usage());
    return 2;
  }
  const runtime = createRuntime({
    webRoot: process.env.DSUI_WEB_ROOT ?? join(process.cwd(), "apps/web/dist"),
  });
  await runtime.refreshConfig();
  const server = Bun.serve({
    fetch: runtime.app.fetch,
    hostname: process.env.DSUI_HOST ?? "0.0.0.0",
    port: Number(process.env.DSUI_PORT ?? 8787),
  });
  console.log(`dsui listening on http://${server.hostname}:${server.port}`);
  return await new Promise<number>(() => undefined);
}

if (import.meta.main) process.exit(await run());
