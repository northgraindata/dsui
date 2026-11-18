import type {
  SettingsSnapshot,
  SettingsSystem,
} from "@northgraindata/dsui-core";
import type { Hono } from "hono";
import { z } from "zod";
import type { AdapterRegistry } from "../adapters/registry";
import type { AdapterReadiness } from "../adapters/types";
import type { DsuiConfig } from "../config";
import type { DsuiDatabase } from "../db/database";
import { readSettings, writeSettings } from "../db/settings";
import type { PluginRuntime } from "../plugins/runtime";
import {
  installationDefaults,
  installationSettingsSchema,
  preferenceDefaults,
  userPreferencesSchema,
} from "../settings";
import { DSUI_VERSION } from "../version";

export function registerSettingsRoutes(
  app: Hono,
  deps: {
    database: DsuiDatabase;
    runtime: PluginRuntime;
    getConfig(): DsuiConfig;
    registry: AdapterRegistry;
    readiness(): Map<string, AdapterReadiness>;
    dataDir: string;
    configPath?: string;
  },
) {
  const db = deps.database.sqlite;
  const canManage = async (
    principal: Parameters<PluginRuntime["authorize"]>[0],
  ) =>
    (principal.role === "owner" || principal.role === "admin") &&
    (await deps.runtime.authorize(principal, "manage"));
  const snapshot = async (
    principal: Parameters<PluginRuntime["authorize"]>[0],
  ): Promise<SettingsSnapshot> => {
    const installation = readSettings(
      db,
      "installation",
      "",
      installationSettingsSchema,
      installationDefaults,
    );
    const preferences = readSettings(
      db,
      "preferences",
      principal.id,
      userPreferencesSchema,
      preferenceDefaults,
    );
    const configured = deps.getConfig().settings ?? {};
    return {
      principalId: principal.id,
      installation: { ...installation.value, ...configured },
      managed: installationSettingsSchema
        .keyof()
        .options.filter((key) => configured[key] !== undefined),
      preferences: preferences.value,
      revision: {
        installation: installation.revision,
        preferences: preferences.revision,
      },
      canManage: await canManage(principal),
      identity: deps.runtime.hasAuthentication() ? "authenticated" : "local",
    };
  };
  app.get("/api/v1/settings", async (context) => {
    if (!(await deps.runtime.authorize(context.get("principal"), "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    return context.json(await snapshot(context.get("principal")));
  });
  app.put("/api/v1/settings/:scope", async (context) => {
    const scope = context.req.param("scope");
    if (scope !== "installation" && scope !== "preferences")
      return context.json({ message: "Unknown settings scope" }, 404);
    const principal = context.get("principal");
    if (!(await deps.runtime.authorize(principal, "inspect")))
      return context.json({ message: "Insufficient permission" }, 403);
    if (scope === "installation" && !(await canManage(principal)))
      return context.json({ message: "Administrator access required" }, 403);
    const body = z
      .object({ revision: z.number().int().nonnegative(), value: z.unknown() })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!body.success)
      return context.json({ message: "Invalid settings request" }, 400);
    const schema =
      scope === "installation"
        ? installationSettingsSchema
        : userPreferencesSchema;
    const parsed = schema.safeParse(body.data.value);
    if (!parsed.success)
      return context.json(
        {
          message: parsed.error.issues.map((issue) => issue.message).join("; "),
        },
        422,
      );
    let valueToWrite = parsed.data;
    if (scope === "installation") {
      const current = await snapshot(principal);
      if (
        current.managed.some(
          (key) =>
            (parsed.data as Record<string, unknown>)[key] !==
            current.installation[key],
        )
      )
        return context.json(
          { message: "Edit configuration-managed values in dsui.yaml" },
          409,
        );
    }
    if (scope === "installation") {
      const stored = readSettings(
        db,
        "installation",
        "",
        installationSettingsSchema,
        installationDefaults,
      ).value;
      const managed = (await snapshot(principal)).managed;
      valueToWrite = {
        ...parsed.data,
        ...Object.fromEntries(managed.map((key) => [key, stored[key]])),
      };
    }
    if (
      !writeSettings(
        db,
        scope,
        scope === "installation" ? "" : principal.id,
        valueToWrite,
        body.data.revision,
      )
    )
      return context.json(
        {
          message: "Settings changed in another session. Reload before saving.",
        },
        409,
      );
    deps.database.audit(principal.id, "settings.update", scope, {
      fields: Object.keys(parsed.data),
    });
    return context.json(await snapshot(principal));
  });
  app.get("/api/v1/settings/system", async (context) => {
    if (!(await canManage(context.get("principal"))))
      return context.json({ message: "Administrator access required" }, 403);
    const config = deps.getConfig();
    const source = (entry: unknown): string => {
      if (!entry || typeof entry !== "object") return "Built in";
      if ("source" in entry && entry.source === "local") return "Local source";
      if ("source" in entry && entry.source === "git") return "Git repository";
      return "Package";
    };
    const adapters = new Map(
      deps.registry.list().map((adapter) => [adapter.id, adapter]),
    );
    const ids = new Set([...adapters.keys(), ...deps.readiness().keys()]);
    const system: SettingsSystem = {
      version: DSUI_VERSION,
      runtime: `Bun ${Bun.version}`,
      platform: `${process.platform} / ${process.arch}`,
      dataDirectory: deps.dataDir,
      configurationFile: deps.configPath ?? null,
      connectionEncryption: "enabled",
      adapters: [...ids].sort().map((id) => ({
        id,
        name: adapters.get(id)?.metadata.name ?? id,
        iconUrl: adapters.get(id)?.metadata.iconUrl,
        status:
          deps.readiness().get(id)?.status === "unavailable"
            ? "unavailable"
            : "ready",
        source: source(config.adapters?.[id]),
      })),
      plugins: deps.runtime.catalog().plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        status: plugin.status,
        source: source(config.plugins?.[plugin.id]),
      })),
    };
    return context.json(system);
  });
}
