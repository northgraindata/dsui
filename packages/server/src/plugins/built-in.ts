import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginSource } from "../config.js";

export type BuiltInPlugin = {
  id: string;
  package: string;
  browserBundle?: string;
};

/**
 * Plugins that ship with DSUI and are always loaded.
 *
 * They are not configurable: there is no `dsui.yaml` entry, no `enabled`
 * flag and no way to turn one off. A `dsui.yaml` entry claiming a built-in
 * id is rejected rather than allowed to shadow it, so an operator cannot
 * substitute a different package for a shipped one.
 *
 * A built-in only loads when the operator's own image or npm package
 * provides its bundle in `DSUI_RUNTIME_PLUGINS`. When the bundle is absent
 * the built-in is skipped silently, so installs that do not ship it are not
 * reported as broken.
 */
export const BUILT_IN_PLUGINS: readonly BuiltInPlugin[] = [
  {
    id: "example-plugin",
    package: "@northgraindata/dsui-plugin-example",
    browserBundle: "@northgraindata/dsui-plugin-example/browser",
  },
];

export const BUILT_IN_PLUGIN_IDS: ReadonlySet<string> = new Set(
  BUILT_IN_PLUGINS.map((plugin) => plugin.id),
);

function bundledPath(specifier: string): string | undefined {
  const match =
    /^@northgraindata\/dsui-plugin-([a-z][a-z0-9-]*)(\/browser)?$/.exec(
      specifier,
    );
  const root = process.env.DSUI_RUNTIME_PLUGINS;
  if (!match || !root) return undefined;
  const path = join(
    root,
    `${match[1]}-plugin${match[2] ? ".browser" : ""}.mjs`,
  );
  return existsSync(path) ? path : undefined;
}

export function builtInSourceMap(): Record<string, PluginSource> {
  return Object.fromEntries(
    BUILT_IN_PLUGINS.filter((plugin) => bundledPath(plugin.package)).map(
      (plugin) => [
        plugin.id,
        {
          package: plugin.package,
          browserBundle: plugin.browserBundle,
          enabled: true,
          config: {},
        },
      ],
    ),
  );
}
