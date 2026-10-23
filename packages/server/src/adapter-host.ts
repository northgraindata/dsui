import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import {
  type ActionBinding,
  createAdapterInstance,
  type ResourceBinding,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import zodToJsonSchema from "zod-to-json-schema";
import { assertAdapterDefinition } from "./adapters/definition.js";
import { DsuiDatabase } from "./db/database.js";
import { SqliteStorePersistenceProvider } from "./db/store-persistence.js";

type HostMethod =
  | "describe"
  | "health"
  | "page"
  | "resource"
  | "action"
  | "job";

interface HostParams {
  connection?: unknown;
  target?: string;
  input?: unknown;
  persistenceNamespace?: string;
  runId?: string;
}

interface HostRequest {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

function reply(id: unknown, result?: unknown, message?: string): void {
  process.stdout.write(
    `${JSON.stringify(
      message
        ? { jsonrpc: "2.0", id, error: { message } }
        : { jsonrpc: "2.0", id, result },
    )}\n`,
  );
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function argument(name: string): string | undefined {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

function jsonSchemaOf(schema: unknown, what: string): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  try {
    return zodToJsonSchema(schema as Parameters<typeof zodToJsonSchema>[0]);
  } catch {
    throw new Error(`Cannot convert ${what} to JSON Schema`);
  }
}

function inputSchemaOf(member: object, what: string): unknown {
  // Runtime members are callables carrying the full definition.
  const inputSchema = (member as { definition?: { inputSchema?: unknown } })
    .definition?.inputSchema;
  if (!inputSchema) return undefined;
  return jsonSchemaOf(inputSchema, `${what} input schema`);
}

/**
 * Imports one verified bundle. With --persistent, serves newline-delimited
 * JSON-RPC requests sequentially and retains opt-in contexts while idle.
 * The parent isolates each persistent process to one service.
 *
 * Usage: bun adapter-host.ts --bundle <absolute-path-to-adapter.mjs>
 */
export async function runAdapterHost(): Promise<number> {
  const bundle = argument("--bundle");
  if (!bundle) fail("adapter-host requires --bundle <absolute-mjs-path>");
  let definition: ReturnType<typeof assertAdapterDefinition>;
  try {
    const module = (await import(pathToFileURL(bundle).href)) as {
      default?: unknown;
      adapter?: unknown;
    };
    definition = assertAdapterDefinition(
      module.default ?? module.adapter,
      bundle,
    );
  } catch (error) {
    fail(
      `Could not load adapter bundle: ${error instanceof Error ? error.message : "invalid bundle"}`,
    );
  }
  const persistent = process.argv.includes("--persistent");
  const databasePath = argument("--database");
  const database = databasePath ? new DsuiDatabase(databasePath) : undefined;
  type Instance = Awaited<ReturnType<typeof createAdapterInstance>>;
  let retained: Instance | undefined;
  let retainedKey: string | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let disposing = Promise.resolve();

  const disposeRetained = (): Promise<void> => {
    const previous = retained;
    retained = undefined;
    retainedKey = undefined;
    disposing = disposing.then(() => previous?.dispose());
    return disposing;
  };

  async function handle(text: string): Promise<void> {
    if (idleTimer) clearTimeout(idleTimer);
    await disposing;
    let request: HostRequest;
    try {
      request = JSON.parse(text) as HostRequest;
      if (
        request.jsonrpc !== "2.0" ||
        typeof request.method !== "string" ||
        (request.params !== undefined &&
          (typeof request.params !== "object" || request.params === null))
      )
        throw new Error("invalid request");
    } catch {
      reply(null, undefined, "invalid JSON-RPC request");
      return;
    }
    const method = request.method as HostMethod;
    const params = (request.params ?? {}) as HostParams;
    const operation = new AbortController();
    const cancelOperation = () =>
      operation.abort(new Error("Adapter host cancelled"));
    if (method === "action" || method === "job")
      process.once("SIGTERM", cancelOperation);
    const connection = params.connection;
    const methodId =
      connection && typeof connection === "object" && "method" in connection
        ? connection.method
        : definition.connectionMethods?.length === 1
          ? definition.connectionMethods[0]?.id
          : undefined;
    const contextIdleTimeoutMs = persistent
      ? (definition.connectionMethods?.find((entry) => entry.id === methodId)
          ?.contextIdleTimeoutMs ?? 0)
      : 0;
    const key = JSON.stringify([params.persistenceNamespace, connection]);
    let instanceForRequest: Instance | undefined;
    const acquire = async (): Promise<Instance> => {
      if (retained && retainedKey !== key) await disposeRetained();
      if (contextIdleTimeoutMs > 0) {
        retained ??= await createAdapterInstance(
          definition,
          connection,
          runtimeOptions,
        );
        retainedKey = key;
        // Clients survive; stores hydrate afresh so isolated jobs/actions can
        // update durable state without leaving this host with a stale snapshot.
        const context = retained.context;
        instanceForRequest = await createAdapterInstance(
          {
            ...definition,
            createContext: async () => context,
            disposeContext: undefined,
          },
          connection,
          runtimeOptions,
        );
      } else {
        instanceForRequest = await createAdapterInstance(
          definition,
          connection,
          runtimeOptions,
        );
      }
      return instanceForRequest;
    };
    // Publish only after request-scoped teardown has released file locks.
    let response:
      | { id: unknown; result?: unknown; message?: string }
      | undefined;
    const respond = (id: unknown, result?: unknown, message?: string): void => {
      response = { id, result, message };
    };
    const runtimeOptions =
      params.persistenceNamespace && database
        ? {
            persistenceProvider: new SqliteStorePersistenceProvider(
              database,
              params.persistenceNamespace,
            ),
          }
        : {};
    try {
      switch (method) {
        case "describe": {
          const methods = definition.connectionMethods;
          const connectionSchema = jsonSchemaOf(
            definition.connectionSchema,
            "connection schema",
          );
          respond(request.id, {
            metadata: definition.metadata,
            sdkVersion: definition.sdkVersion,
            // The connection form is served from the host, so the schema has to
            // cross the process boundary with the rest of the description.
            ...(connectionSchema ? { connectionSchema } : {}),
            ...(methods
              ? {
                  connectionMethods: methods.map((method) => ({
                    id: method.id,
                    label: method.label,
                    ...(method.description
                      ? { description: method.description }
                      : {}),
                    requestConcurrency: method.requestConcurrency,
                    contextIdleTimeoutMs: method.contextIdleTimeoutMs ?? 0,
                    schema: jsonSchemaOf(
                      method.schema,
                      `connection method "${method.id}"`,
                    ),
                    ...(method.group ? { group: { ...method.group } } : {}),
                  })),
                }
              : {}),
            resources: definition.resources.map((resource) => ({
              id: resource.id,
              ...(resource.policy ? { policy: resource.policy } : {}),
              inputSchema: inputSchemaOf(resource, `resource "${resource.id}"`),
              refresh: { ...resource.refresh },
            })),
            actions: definition.actions.map((action) => ({
              id: action.id,
              inputSchema: inputSchemaOf(action, `action "${action.id}"`),
            })),
            pages: definition.pages.map((page) => ({ path: page.path })),
            jobs: definition.jobs.map((job) => ({
              id: job.id,
              ...(job.inputSchema
                ? {
                    inputSchema: jsonSchemaOf(
                      job.inputSchema,
                      `job "${job.id}"`,
                    ),
                  }
                : {}),
              ...(job.schedule ? { schedule: job.schedule } : {}),
              ...(job.intervalMs !== undefined
                ? { intervalMs: job.intervalMs }
                : {}),
              concurrency: job.concurrency,
              timeoutMs: job.timeoutMs,
              retry: { ...job.retry },
            })),
            signals: definition.signals.map((signal) => ({
              id: signal.id,
              type: signal.type,
              schema: jsonSchemaOf(signal.schema, `signal "${signal.id}"`),
            })),
            components: [],
          });
          break;
        }
        case "health": {
          // The adapter decides what healthy means; this host only supplies the
          // connection, times the call and validates the report before it
          // crosses the process boundary.
          const started = Date.now();
          let instance: Awaited<ReturnType<typeof createAdapterInstance>>;
          try {
            instance = await acquire();
          } catch (error) {
            respond(request.id, {
              status: "unavailable",
              checkedAt: new Date().toISOString(),
              latencyMs: Date.now() - started,
              detail:
                error instanceof Error ? error.message : "Health probe failed",
              score: 0,
              checks: [
                {
                  id: "reachability",
                  label: "Service reachable",
                  ok: false,
                  detail:
                    error instanceof Error
                      ? error.message
                      : "Health probe failed",
                },
              ],
            });
            break;
          }
          try {
            const report =
              typeof definition.health === "function"
                ? await definition.health(instance.context)
                : {
                    status: "healthy" as const,
                    score: 100,
                    checks: [
                      {
                        id: "reachability",
                        label: "Service reachable",
                        ok: true,
                      },
                    ],
                  };
            respond(request.id, {
              ...report,
              checkedAt: new Date().toISOString(),
              latencyMs: report.latencyMs ?? Date.now() - started,
            });
          } catch (error) {
            respond(request.id, {
              status: "unavailable",
              checkedAt: new Date().toISOString(),
              latencyMs: Date.now() - started,
              detail:
                error instanceof Error ? error.message : "Health probe failed",
              score: 0,
              checks: [
                {
                  id: "reachability",
                  label: "Service reachable",
                  ok: false,
                  detail:
                    error instanceof Error
                      ? error.message
                      : "Health probe failed",
                },
              ],
            });
          }
          break;
        }
        case "page": {
          const path = (params.input as { path?: unknown } | undefined)?.path;
          if (typeof path !== "string" || !path.startsWith("/"))
            throw new Error("Page path must be an absolute path");
          const instance = await acquire();
          const scope = instance.createPageScope(path);
          try {
            await scope.ready();
            respond(request.id, {
              path,
              nodes: serializeNodes(scope.render()),
            });
          } finally {
            scope.dispose();
          }
          break;
        }
        case "resource": {
          const resource = definition.resources.find(
            (item) => item.id === params.target,
          );
          if (!resource) throw new Error(`Unknown resource: ${params.target}`);
          const instance = await acquire();
          const binding = (
            resource as unknown as (
              input: unknown,
            ) => ResourceBinding<unknown, unknown, unknown>
          )(params.input);
          const result = await instance.executeResource(binding);
          if (result.status === "error") throw result.error;
          respond(request.id, { data: result.data });
          break;
        }
        case "action": {
          const action = definition.actions.find(
            (item) => item.id === params.target,
          );
          if (!action) throw new Error(`Unknown action: ${params.target}`);
          const instance = await acquire();
          const binding = (
            action as unknown as (
              input: unknown,
            ) => ActionBinding<unknown, unknown, unknown>
          )(params.input);
          const { result, emissions } = await instance.executeActionWithSignals(
            binding,
            { signal: operation.signal },
          );
          if (result.status === "error")
            respond(request.id, {
              result: { status: "error", message: result.error.message },
              emissions,
            });
          else
            respond(request.id, {
              result: { status: "success", data: result.data },
              emissions,
            });
          break;
        }
        case "job": {
          if (
            typeof params.target !== "string" ||
            typeof params.runId !== "string"
          )
            throw new Error("Job execution requires a job id and run id");
          const instance = await acquire();
          const emissions = await instance.runJob(params.target, params.input, {
            runId: params.runId,
            signal: operation.signal,
          });
          respond(request.id, emissions);
          break;
        }
        default:
          respond(request.id, undefined, `Unknown method: ${String(method)}`);
      }
    } catch (error) {
      respond(
        request.id,
        undefined,
        error instanceof Error ? error.message : "Adapter host failed",
      );
    } finally {
      try {
        if (instanceForRequest) await instanceForRequest.dispose();
        if (retained) {
          idleTimer = setTimeout(() => {
            void disposeRetained().catch((error: unknown) => {
              process.stderr.write(
                `Context disposal failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
              );
              process.exit(1);
            });
          }, contextIdleTimeoutMs);
          idleTimer.unref();
        }
      } catch (error) {
        respond(
          request.id,
          undefined,
          error instanceof Error ? error.message : "Context disposal failed",
        );
      }
      if (response) reply(response.id, response.result, response.message);
      process.off("SIGTERM", cancelOperation);
    }
  }

  try {
    if (persistent) {
      const lines = createInterface({
        input: process.stdin,
        crlfDelay: Infinity,
      });
      for await (const line of lines) await handle(line);
    } else {
      await handle(await new Response(Bun.stdin.stream()).text());
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    await disposeRetained();
    database?.close();
  }
  return 0;
}

if (import.meta.main) process.exit(await runAdapterHost());
