import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  definePlugin,
  defineSlot,
  type PluginPrincipal,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import { createRuntime } from "../src/app";

test("global profile slots receive the authenticated caller without service access or cross-request identity leakage", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsui-profile-slot-"));
  let principal: PluginPrincipal | null = { id: "alice", role: "viewer" };
  let pluginAllowed = true;
  const seen: Array<{ id?: string; service: unknown }> = [];
  const plugin = definePlugin({
    metadata: {
      id: "identity",
      name: "Identity",
      version: "1.0.0",
      apiVersion: 1,
      security: true,
    },
    configSchema: z.object({}),
    setup(registry) {
      registry.authentication({ authenticate: () => principal });
      registry.authorization({
        authorize: ({ resource }) =>
          resource?.type === "service" ? false : pluginAllowed,
      });
      registry.slot(
        defineSlot({
          id: "profile",
          slot: "sidebar.profile",
          render: ({ principal, service }) => {
            seen.push({ id: principal?.id, service });
            return [];
          },
        }),
      );
      registry.slot(
        defineSlot({
          id: "help-overlay",
          slot: "overlay",
          presentation: { mode: "modal", label: "Help" },
          render: () => [],
        }),
      );
    },
  });
  const runtime = createRuntime({
    dataDir: root,
    config: {
      services: [],
      plugins: {
        identity: {
          package: "fixture",
          enabled: true,
          critical: true,
          config: {},
        },
      },
    },
    pluginModuleLoader: async () => ({ default: plugin }),
  });
  const call = (slot = "sidebar.profile", body: unknown = { serviceIds: [] }) =>
    runtime.app.request(`/api/v1/plugins/slots/${slot}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    await runtime.refreshConfig();
    expect((await call()).status).toBe(200);
    const overlays = await (
      await call("overlay", {
        serviceIds: [],
        pluginId: "identity",
        slotIds: ["help-overlay"],
      })
    ).json();
    expect(overlays.items).toEqual([
      {
        serviceId: "",
        pluginId: "identity",
        slotId: "help-overlay",
        slot: "overlay",
        presentation: { mode: "modal", label: "Help" },
        nodes: [],
      },
    ]);
    principal = { id: "bob", role: "operator" };
    expect((await call()).status).toBe(200);
    expect(seen).toEqual([
      { id: "alice", service: undefined },
      { id: "bob", service: undefined },
    ]);
    expect(
      (
        await call("sidebar.profile", {
          serviceIds: [],
          principal: { id: "alice" },
        })
      ).status,
    ).toBe(422);
    pluginAllowed = false;
    expect((await call()).status).toBe(403);
    pluginAllowed = true;
    expect(
      (await (await call("dashboard.service-card.trailing")).json()).items,
    ).toEqual([]);
    principal = null;
    expect((await call()).status).toBe(401);
    expect(seen.length).toBe(2);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});
