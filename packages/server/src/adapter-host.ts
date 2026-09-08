import { pathToFileURL } from "node:url";
import {
  type ActionBinding,
  createAdapterInstance,
  type ResourceBinding,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import type { HealthStatus } from "@northgraindata/dsui-core";
import zodToJsonSchema from "zod-to-json-schema";
import { assertAdapterDefinition } from "./adapters/loader.js";

type HostMethod = "describe" | "health" | "page" | "resource" | "action";

interface HostParams {
  connection?: unknown;
  target?: string;
  input?: unknown;
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

function inputSchemaOf(member: object, what: string): unknown {
  // Runtime members are callables carrying the full definition.
  const inputSchema = (member as { definition?: { inputSchema?: unknown } })
    .definition?.inputSchema;
  if (!inputSchema) return undefined;
  try {
    return zodToJsonSchema(
      inputSchema as Parameters<typeof zodToJsonSchema>[0],
    );
  } catch {
    throw new Error(`Cannot convert ${what} input schema to JSON Schema`);
  }
}

/**
 * Isolated adapter host: imports one verified bundle, serves exactly one
 * JSON-RPC request from stdin, prints one response line, exits. Stateless
 * by construction — no cross-request state can leak.
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
  let request: HostRequest;
  try {
    const text = await new Response(Bun.stdin.stream()).text();
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
    return 0;
  }
  const method = request.method as HostMethod;
  const params = (request.params ?? {}) as HostParams;
  try {
    switch (method) {
      case "describe": {
        reply(request.id, {
          metadata: definition.metadata,
          sdkVersion: definition.sdkVersion,
          resources: definition.resources.map((resource) => ({
            id: resource.id,
            inputSchema: inputSchemaOf(resource, `resource "${resource.id}"`),
            refresh: { ...resource.refresh },
          })),
          actions: definition.actions.map((action) => ({
            id: action.id,
            inputSchema: inputSchemaOf(action, `action "${action.id}"`),
          })),
          pages: definition.pages.map((page) => ({ path: page.path })),
        });
        break;
      }
      case "health": {
        const started = Date.now();
        try {
          const instance = await createAdapterInstance(
            definition,
            params.connection,
          );
          try {
            const status: HealthStatus = {
              status: "healthy",
              checkedAt: new Date().toISOString(),
              latencyMs: Date.now() - started,
            };
            reply(request.id, status);
          } finally {
            await instance.dispose();
          }
        } catch (error) {
          reply(request.id, {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail:
              error instanceof Error ? error.message : "Health probe failed",
          });
        }
        break;
      }
      case "page": {
        const path = (params.input as { path?: unknown } | undefined)?.path;
        if (typeof path !== "string" || !path.startsWith("/"))
          throw new Error("Page path must be an absolute path");
        const instance = await createAdapterInstance(
          definition,
          params.connection,
        );
        try {
          const scope = instance.createPageScope(path);
          try {
            reply(request.id, { path, nodes: serializeNodes(scope.render()) });
          } finally {
            scope.dispose();
          }
        } finally {
          await instance.dispose();
        }
        break;
      }
      case "resource": {
        const resource = definition.resources.find(
          (item) => item.id === params.target,
        );
        if (!resource) throw new Error(`Unknown resource: ${params.target}`);
        const instance = await createAdapterInstance(
          definition,
          params.connection,
        );
        try {
          const binding = (
            resource as unknown as (
              input: unknown,
            ) => ResourceBinding<unknown, unknown, unknown>
          )(params.input);
          const result = await instance.executeResource(binding);
          if (result.status === "error") throw result.error;
          reply(request.id, { data: result.data });
        } finally {
          await instance.dispose();
        }
        break;
      }
      case "action": {
        const action = definition.actions.find(
          (item) => item.id === params.target,
        );
        if (!action) throw new Error(`Unknown action: ${params.target}`);
        const instance = await createAdapterInstance(
          definition,
          params.connection,
        );
        try {
          const binding = (
            action as unknown as (
              input: unknown,
            ) => ActionBinding<unknown, unknown, unknown>
          )(params.input);
          const result = await instance.executeAction(binding);
          if (result.status === "error")
            reply(request.id, {
              status: "error",
              message: result.error.message,
            });
          else reply(request.id, { status: "success", data: result.data });
        } finally {
          await instance.dispose();
        }
        break;
      }
      default:
        reply(request.id, undefined, `Unknown method: ${String(method)}`);
    }
  } catch (error) {
    reply(
      request.id,
      undefined,
      error instanceof Error ? error.message : "Adapter host failed",
    );
  }
  return 0;
}

if (import.meta.main) process.exit(await runAdapterHost());
