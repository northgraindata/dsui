import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type {
  ExecutionGrant,
  PluginPrincipal,
  PluginServiceCatalog,
} from "@northgraindata/dsui-plugin-sdk";
import { ExecutionService } from "../src/plugins/execution";

const revision = `sha256:${"a".repeat(64)}`;
function fixture() {
  const db = new Database(":memory:");
  let principal: PluginPrincipal | null = { id: "admin", role: "admin" };
  const people = new Map<string, PluginPrincipal>([
    ["admin", { id: "admin", role: "admin" }],
    [
      "viewer",
      { id: "viewer", role: "viewer", attributes: { teams: ["users"] } },
    ],
    ["execution:app", { id: "execution:app", role: "operator" }],
  ]);
  let permitted = true,
    mutations = 0,
    authenticated = true;
  let beforeDispatch: (() => void) | undefined;
  const services: PluginServiceCatalog = {
    list: async () => ({ items: [] }),
    get: async (id) => ({
      id,
      adapter: "mock",
      name: id,
      managedBy: "configuration",
    }),
    listResources: async () => [{ id: "read" }],
    listActions: async () => [{ id: "change" }],
    queryResource: async () => ({ ok: true }),
    executeAction: async (_id, _action, input) => {
      mutations++;
      return input;
    },
    probe: async () => null,
  };
  const service = new ExecutionService(db, {
    principal: () => principal,
    authenticated: () => authenticated,
    canResolve: () => true,
    canDelegate: () => true,
    resolve: async (id) => people.get(id) ?? null,
    authorize: async (who, permission, resource) =>
      resource?.type === "service"
        ? permitted &&
          (who.id === "execution:app" || who.role === "admin") &&
          (permission !== "execute" || who.role !== "viewer")
        : true,
    invoke: async (_executor, _actor, work, check) => {
      beforeDispatch?.();
      await check?.();
      return work();
    },
    services,
    audit: () => {
      /* Audit storage is exercised by the host integration tests. */
    },
  });
  const grant: ExecutionGrant = {
    id: "grant",
    subject: "app",
    revision,
    executorId: "execution:app",
    operationIds: ["submit"],
    audience: { roles: ["viewer"], claims: { teams: ["users"] } },
    targets: [
      {
        serviceId: "data",
        kind: "action",
        id: "change",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { allowed: { const: true } },
          required: ["allowed"],
        },
      },
    ],
    expiresAt: Date.now() + 3600000,
  };
  const request = {
    subject: "app",
    revision,
    operationId: "submit",
    grantId: "grant",
    targets: grant.targets,
  };
  return {
    db,
    service,
    grant,
    request,
    setPrincipal: (value: PluginPrincipal | null) => {
      principal = value;
    },
    people,
    setPermitted: (value: boolean) => {
      permitted = value;
    },
    setAuthenticated: (value: boolean) => {
      authenticated = value;
    },
    mutations: () => mutations,
    beforeDispatch: (work: () => void) => {
      beforeDispatch = work;
    },
  };
}
describe("bounded plugin execution", () => {
  test("rechecks a grant after host configuration refresh immediately before dispatch", async () => {
    const f = fixture();
    try {
      f.service.configure({ apps: [f.grant] });
      f.setPrincipal(f.people.get("viewer") ?? null);
      const scope = await f.service.forPlugin("apps").open(f.request);
      f.beforeDispatch(() => f.service.configure({}));
      await expect(
        scope.services.executeAction("data", "change", { allowed: true }),
      ).rejects.toThrow("grant");
      expect(f.mutations()).toBe(0);
    } finally {
      f.db.close();
    }
  });
  test("delegates only an approved revision, target and constrained input", async () => {
    const f = fixture();
    try {
      const api = f.service.forPlugin("apps");
      await api.approve(f.grant);
      f.setPrincipal(f.people.get("viewer") ?? null);
      const scope = await api.open(f.request);
      expect(scope.actor.role).toBe("viewer");
      expect(scope.executor.role).toBe("operator");
      await scope.services.executeAction("data", "change", { allowed: true });
      await expect(
        scope.services.executeAction("data", "change", { allowed: false }),
      ).rejects.toThrow("constraints");
      await expect(
        scope.services.executeAction("other", "change", { allowed: true }),
      ).rejects.toThrow("outside");
      await expect(
        api.open({ ...f.request, revision: `sha256:${"b".repeat(64)}` }),
      ).rejects.toThrow("grant");
      expect(f.mutations()).toBe(1);
      scope.close();
      await expect(scope.check()).rejects.toThrow("closed");
    } finally {
      f.db.close();
    }
  });
  test("continuations retain authority without a request and cannot cross plugin or revision boundaries", async () => {
    const f = fixture();
    try {
      const api = f.service.forPlugin("apps");
      await api.approve(f.grant);
      f.setPrincipal(f.people.get("viewer") ?? null);
      const scope = await api.open(f.request),
        continuationId = await scope.checkpoint();
      expect(await scope.checkpoint()).toBe(continuationId);
      scope.close();
      f.setPrincipal(null);
      const resumed = await api.open({ ...f.request, continuationId });
      await resumed.services.executeAction("data", "change", { allowed: true });
      await expect(
        f.service.forPlugin("other").open({ ...f.request, continuationId }),
      ).rejects.toThrow("unavailable");
      await expect(
        api.open({ ...f.request, operationId: "different", continuationId }),
      ).rejects.toThrow("does not match");
      f.people.delete("viewer");
      await expect(resumed.check()).rejects.toThrow("revoked");
    } finally {
      f.db.close();
    }
  });
  test("refreshes actor claims and blocks revoked grants and execution identities", async () => {
    const f = fixture();
    try {
      const api = f.service.forPlugin("apps");
      await api.approve(f.grant);
      f.setPrincipal(f.people.get("viewer") ?? null);
      const scope = await api.open(f.request);
      f.people.set("viewer", {
        id: "viewer",
        role: "viewer",
        attributes: { teams: [] },
      });
      await expect(scope.check()).rejects.toThrow("grant");
      f.people.set("viewer", {
        id: "viewer",
        role: "viewer",
        attributes: { teams: ["users"], fresh: true },
      });
      await scope.check();
      expect(scope.actor.attributes?.fresh).toBe(true);
      f.setPermitted(false);
      await expect(
        scope.services.executeAction("data", "change", { allowed: true }),
      ).rejects.toThrow("revoked");
      f.setPermitted(true);
      f.setPrincipal(f.people.get("admin") ?? null);
      await api.revoke("grant");
      await expect(scope.check()).rejects.toThrow("grant");
      expect(f.mutations()).toBe(0);
    } finally {
      f.db.close();
    }
  });
  test("configured grants cannot be shadowed and unsafe async schemas cannot bypass constraints", async () => {
    const f = fixture();
    try {
      f.service.configure({ apps: [f.grant] });
      const api = f.service.forPlugin("apps");
      await expect(api.approve(f.grant)).rejects.toThrow("configuration");
      await expect(api.revoke("grant")).rejects.toThrow("configuration");
      await expect(
        api.open({
          ...f.request,
          targets: [{ ...f.grant.targets[0], inputSchema: { $async: true } }],
        }),
      ).rejects.toThrow("Unsupported");
      f.setAuthenticated(false);
      await expect(api.approve({ ...f.grant, id: "new" })).rejects.toThrow(
        "Authenticated administrator",
      );
    } finally {
      f.db.close();
    }
  });
});
