import { join } from "node:path";
import { runAdapterHost } from "./adapter-host";
import { loadAdapter } from "./adapters/loader";
import { createRuntime } from "./app";
import { isAdapterSource, loadConfig } from "./config";

const VERSION = "0.1.0";

function usage(): string {
  return `dsui ${VERSION}

Usage:
  dsui [serve]
  dsui version
  dsui doctor
  dsui adapter-host --bundle <path>

Adapters are resolved by package name from dsui.yaml; connections live
in dsui.yaml or are managed in the UI.`;
}

async function serve(): Promise<never> {
  const runtime = createRuntime({
    webRoot: process.env.DSUI_WEB_ROOT ?? join(process.cwd(), "apps/web/dist"),
  });
  await runtime.refreshConfig();
  const server = Bun.serve({
    fetch: runtime.app.fetch,
    hostname: process.env.DSUI_HOST ?? "0.0.0.0",
    port: Number(process.env.DSUI_PORT ?? 4192),
  });
  console.log(`dsui listening on http://${server.hostname}:${server.port}`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await server.stop();
    await runtime.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await new Promise<never>(() => undefined);
  throw new Error("unreachable");
}

async function doctor(): Promise<number> {
  const configPath = process.env.DSUI_CONFIG;
  try {
    const config = await loadConfig(configPath);
    console.log(`Configuration: ${configPath ?? "not configured"}`);
    console.log(`Services: ${config.services.length}`);
    const entries = Object.entries(config.adapters ?? {});
    if (!entries.length)
      console.log("Adapters: none configured — empty registry");
    for (const [id, entry] of entries) {
      try {
        if (!isAdapterSource(entry))
          throw new Error("not an adapter source (presentation override?)");
        await loadAdapter(
          id,
          "version" in entry
            ? {
                package: entry.package,
                version: entry.version,
                integrity: entry.integrity,
                ...(entry.entry ? { entry: entry.entry } : {}),
              }
            : { package: entry.package },
        );
        console.log(`ok ${id}`);
      } catch (error) {
        console.error(
          `unavailable ${id}: ${error instanceof Error ? error.message : "failed"}`,
        );
        return 1;
      }
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

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const [command = "serve", ...args] = argv;
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  if (command === "doctor") return doctor();
  if (command === "adapter-host") {
    const argv = [process.argv[0] ?? "bun", ...args];
    process.argv = argv;
    return runAdapterHost();
  }
  if (command !== "serve" && command !== "start") {
    console.error(usage());
    return 2;
  }
  await serve();
  throw new Error("unreachable");
}

if (import.meta.main) process.exit(await run());
