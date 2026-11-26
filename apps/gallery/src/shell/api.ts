/**
 * Answers the application's API from fixtures, so the real web app runs without
 * a server. Only requests under `/api/v1/` are intercepted.
 */
import {
  installationDefaults,
  preferenceDefaults,
  type SettingsSnapshot,
  type SettingsSystem,
} from "@northgraindata/dsui-core";
import type { Scenario } from "@northgraindata/dsui-ui-fixtures";
import { answerAction, answerResource } from "../answers";
import {
  loadData,
  loadManifest,
  loadNodes,
  type ManifestAdapter,
} from "../data";
import { resolveUrl } from "../urls";

interface Request {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  adapters: ManifestAdapter[];
  scenario: Scenario;
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const failure = (message: string, status = 404) => json({ message }, status);

function publicAdapter({ catalog, pages }: ManifestAdapter) {
  return {
    ...catalog,
    pages: pages.map(({ path }) => ({ path })),
    components: [],
  };
}

function publicService({ id, name, catalog }: ManifestAdapter) {
  return {
    id,
    name,
    adapter: id,
    category: catalog.presentation?.category ?? "Other",
    endpoint: `fixture://${id}`,
    health: "healthy",
    latencyMs: 12,
    managedBy: "ui",
    logo: catalog.iconUrl,
    resources: catalog.resources.map((resource) => resource.id),
    actions: catalog.actions.map((action) => action.id),
  };
}

const settings: SettingsSnapshot = {
  principalId: "local",
  installation: installationDefaults,
  managed: [],
  preferences: preferenceDefaults,
  revision: { installation: 1, preferences: 1 },
  canManage: true,
  identity: "local",
};

function system(adapters: ManifestAdapter[]): SettingsSystem {
  return {
    version: "0.0.0-gallery",
    runtime: "fixtures",
    platform: "browser",
    dataDirectory: "/data",
    configurationFile: null,
    connectionEncryption: "enabled",
    adapters: adapters.map(({ id, name, catalog }) => ({
      id,
      name,
      iconUrl: catalog.iconUrl,
      status: "ready",
      source: "fixtures",
    })),
    plugins: [],
  };
}

/** Routes whose answer does not depend on one service. */
const STATIC: Record<string, (request: Request) => unknown> = {
  "GET /auth/me": () => ({ id: "local", role: "owner" }),
  "GET /auth/entry": () => ({ mode: "none" }),
  "GET /services": ({ adapters }) => adapters.map(publicService),
  "GET /adapters": ({ adapters }) => adapters.map(publicAdapter),
  "GET /plugins": () => ({
    plugins: [],
    pages: [],
    navigation: [],
    slots: [],
  }),
  "GET /settings": () => settings,
  "GET /settings/system": ({ adapters }) => system(adapters),
  "GET /connectors": () => [],
  "GET /secret-providers": () => [],
  "POST /services/test": () => ({ status: "healthy", latencyMs: 12 }),
};

async function serviceRoute(request: Request): Promise<Response | undefined> {
  const [, root, serviceId, kind, itemId] = request.path.split("/");
  if (root !== "services" || !serviceId) return undefined;
  const adapter = request.adapters.find((entry) => entry.id === serviceId);
  if (!adapter) return failure(`Unknown service ${serviceId}`);
  if (!kind) return json(publicService(adapter));
  if (kind === "pages")
    return json({ pages: adapter.pages.map(({ path }) => ({ path })) });
  if (kind === "page") {
    const href = request.query.get("path") ?? "/";
    const match = resolveUrl(adapter, href);
    if (!match) return failure(`No fixture page for ${href}`);
    return json({
      path: href.split("?")[0],
      nodes: await loadNodes(adapter.id, match.file),
    });
  }
  const data = await loadData(adapter.id, request.scenario);
  if (kind === "actions" && itemId)
    return json(await answerAction(data, request.scenario, itemId));
  if (kind === "resources" && itemId)
    return answerResource(data, request.scenario, itemId).then(
      (value) => json({ data: value }),
      (cause: Error) => failure(cause.message, 502),
    );
  return undefined;
}

async function respond(request: Request): Promise<Response> {
  const handler = STATIC[`${request.method} ${request.path}`];
  if (handler) return json(handler(request));
  if (request.path.startsWith("/plugins/slots/")) return json({ items: [] });
  if (request.method === "PUT" && request.path.startsWith("/settings/"))
    return json(settings);
  const service = await serviceRoute(request);
  return (
    service ??
    failure(`The gallery has no fixture for ${request.method} ${request.path}`)
  );
}

export function installFixtureApi(scenario: Scenario): void {
  const network = window.fetch.bind(window);
  const manifest = loadManifest();
  const intercept = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.origin,
    );
    if (!url.pathname.startsWith("/api/v1/")) return network(input, init);
    return respond({
      method: (init?.method ?? "GET").toUpperCase(),
      path: url.pathname.slice("/api/v1".length),
      query: url.searchParams,
      body: init?.body,
      adapters: await manifest,
      scenario,
    });
  };
  window.fetch = Object.assign(intercept, window.fetch);
}
