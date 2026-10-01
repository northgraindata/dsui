import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { runAdapterHost } from "./adapter-host";
import { loadAdapter } from "./adapters/loader";
import { type AdapterLoadEvent, createRuntime, defaultDataDir } from "./app";
import { type Outcome, Progress } from "./cli/progress";
import {
  type AdapterReport,
  doctorJson,
  renderDoctor,
  renderHelp,
  renderServe,
} from "./cli/report";
import {
  type AdapterEntry,
  isAdapterSource,
  loadConfig,
  toAdapterSourceLocation,
} from "./config";
import { DSUI_VERSION } from "./version";

const VERSION = DSUI_VERSION;
const DEFAULT_PORT = 4192;

/**
 * Collects load events so the report can be rendered once loading has settled.
 * Insertion order is preserved so adapters appear in configuration order.
 */
function collector() {
  const reports = new Map<string, AdapterReport>();
  return {
    reports: (): AdapterReport[] => [...reports.values()],
    onEvent: (event: AdapterLoadEvent): void => {
      if (event.phase === "start") return;
      reports.set(event.id, {
        id: event.id,
        result: {
          status: event.ok ? "ok" : "failed",
          ms: event.ms,
          ...(event.ok ? { name: event.name } : {}),
          ...(event.detail ? { detail: event.detail } : {}),
        },
      });
    },
  };
}

/** The address a human should open, which is not the bind address. */
function openableUrl(hostname: string, port: number): string {
  const host =
    hostname === "0.0.0.0" || hostname === "::" ? "localhost" : hostname;
  return `http://${host}:${port}`;
}
async function serve(): Promise<never> {
  const progress = new Progress();
  const sink = collector();
  const runtime = createRuntime({
    webRoot: process.env.DSUI_WEB_ROOT ?? join(process.cwd(), "apps/web/dist"),
    onAdapterLoad: (event) => {
      if (event.phase === "start") progress.reserve([event.id]);
      else sink.onEvent(event);
    },
  });

  // A failed adapter is survivable: the registry comes up without it and the
  // operator is told which one, so startup continues and says so.
  await runtime.refreshConfig();
  progress.finish();

  const hostname = process.env.DSUI_HOST ?? "0.0.0.0";
  const port = Number(process.env.DSUI_PORT ?? DEFAULT_PORT);
  // server.port is the port actually bound, which differs from the request
  // when DSUI_PORT is 0 and the OS picks one.
  const server = Bun.serve({ fetch: runtime.app.fetch, hostname, port });
  process.stdout.write(
    renderServe({
      url: openableUrl(hostname, server.port ?? port),
      adapters: sink.reports(),
    }),
  );

  await new Promise<never>(() => undefined);
  throw new Error("unreachable");
}

/**
 * Condenses a failed build into one line.
 *
 * A bundler failure names every unresolvable native specifier it tried, which
 * for duckdb is a dozen platform bindings. `doctor` reports the reason, and
 * the full text stays available on the error for anyone debugging.
 */
function summarise(detail: string): string {
  const firstLine = detail.split("\n")[0] ?? detail;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

/** Builds an adapter for real, naming each build phase while it runs. */
async function buildAdapter(
  id: string,
  entry: AdapterEntry,
  dataDir: string,
  note: (phase: string) => void,
): Promise<Outcome> {
  if (!isAdapterSource(entry))
    return { ok: false, detail: "not an adapter source" };
  try {
    const loaded = await loadAdapter(
      id,
      toAdapterSourceLocation(entry, process.cwd()),
      { dataDir, onPhase: note },
    );
    return { ok: true, name: loaded.metadata.name };
  } catch (error) {
    return {
      ok: false,
      detail: summarise(error instanceof Error ? error.message : "load failed"),
    };
  }
}

/**
 * Confirms an adapter's source is present without building it.
 *
 * `examples/data-stack/compose.yaml` runs `doctor --check-adapters` every ten
 * seconds with a five second timeout, and a real build compiles and bundles,
 * so that flag has to stay cheap enough to fit the budget.
 */
async function inspectSource(entry: AdapterEntry): Promise<Outcome> {
  if (!isAdapterSource(entry))
    return { ok: false, detail: "not an adapter source" };
  const location = toAdapterSourceLocation(entry, process.cwd());
  if (location.kind !== "local") return { ok: true, name: location.repository };
  return existsSync(location.path)
    ? { ok: true, name: basename(location.path) }
    : { ok: false, detail: `missing ${location.path}` };
}

async function checkAdapters(
  entries: Readonly<Record<string, AdapterEntry>>,
  deep: boolean,
): Promise<AdapterReport[]> {
  const progress = new Progress();
  progress.reserve(Object.keys(entries));
  const reports: AdapterReport[] = [];
  const dataDir = defaultDataDir();

  // Every adapter is checked: stopping at the first failure hid the state of
  // everything after it, which is the part an operator actually needs.
  for (const [id, entry] of Object.entries(entries)) {
    const outcome = await progress.runOutcome({
      label: id,
      onPhase: (phase) => progress.note(phase),
      run: () =>
        deep
          ? buildAdapter(id, entry, dataDir, (phase) => progress.note(phase))
          : inspectSource(entry),
    });
    reports.push({ id, result: outcome });
  }
  progress.finish();
  return reports;
}

async function doctor(args: readonly string[]): Promise<number> {
  const json = args.includes("--json");
  // Absent means the deep check; the flag exists for cheap polling.
  const deep = !args.includes("--check-adapters");
  const configPath = process.env.DSUI_CONFIG;
  const started = performance.now();
  try {
    const config = await loadConfig(configPath);
    const adapters = await checkAdapters(config.adapters ?? {}, deep);
    const report = {
      version: VERSION,
      configPath: configPath ?? "not configured",
      adapters,
      services: config.services.length,
      elapsedMs: performance.now() - started,
    };
    process.stdout.write(json ? doctorJson(report) : renderDoctor(report));
    return adapters.every((a) => a.result.status === "ok") ? 0 : 1;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "failed";
    process.stderr.write(`Doctor: ${detail}\n`);
    return 1;
  }
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const [command = "serve", ...args] = argv;
  if (command === "version" || command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${renderHelp(VERSION)}\n`);
    return 0;
  }
  if (command === "doctor") return doctor(args);
  if (command === "adapter-host") {
    process.argv = [process.argv[0] ?? "bun", ...args];
    return runAdapterHost();
  }
  if (command !== "serve" && command !== "start") {
    process.stderr.write(`${renderHelp(VERSION)}\n`);
    return 2;
  }
  await serve();
  throw new Error("unreachable");
}

if (import.meta.main) process.exit(await run());
