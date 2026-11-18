import type { SettingsSystem } from "@northgraindata/dsui-core";
import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { Link } from "@tanstack/react-router";
import { Icon } from "../../components/icon";
import { ServiceMark } from "../../components/service-mark";
import { SettingsPanel } from "./settings-fields";
import { settingsEntries } from "./settings-navigation";

export function ExtensionSettings({
  system,
  catalog,
}: {
  system: SettingsSystem;
  catalog: PluginCatalog;
}) {
  const entries = settingsEntries(catalog);
  return (
    <>
      <SettingsPanel
        title="Plugins"
        description="Capabilities loaded by this installation. Each plugin owns its configuration."
      >
        {system.plugins.length ? (
          system.plugins.map((plugin) => (
            <div key={plugin.id} className="settings-extension">
              <Icon name="plug" size={18} />
              <div className="settings-extension-main">
                <strong>{plugin.name}</strong>
                <p>
                  {plugin.version} · {plugin.source}
                </p>
                <div className="settings-extension-links">
                  {entries
                    .filter((entry) => entry.pluginId === plugin.id)
                    .map((entry) => (
                      <Link
                        key={entry.id}
                        to="/plugins/$pluginId/$"
                        params={{ pluginId: plugin.id, _splat: entry.id }}
                      >
                        {entry.settings?.label ?? entry.title} ↗
                      </Link>
                    ))}
                </div>
              </div>
              <span className="settings-pill">
                {plugin.status === "ready"
                  ? "Loaded"
                  : plugin.status === "disabled"
                    ? "Disabled"
                    : "Unavailable"}
              </span>
            </div>
          ))
        ) : (
          <p className="settings-section-intro p-5">
            No plugins configured. Add plugins in dsui.yaml to extend this
            workspace.
          </p>
        )}
      </SettingsPanel>
      <SettingsPanel
        title="Adapters"
        description="Connection capabilities available to your services."
      >
        {system.adapters.length ? (
          system.adapters.map((adapter) => (
            <div className="settings-extension" key={adapter.id}>
              <ServiceMark
                adapter={adapter.id}
                logo={adapter.iconUrl}
                size={32}
              />
              <div className="settings-extension-main">
                <strong>{adapter.name}</strong>
                <p>{adapter.source}</p>
              </div>
              <span className="settings-pill">
                {adapter.status === "ready" ? "Loaded" : "Unavailable"}
              </span>
            </div>
          ))
        ) : (
          <p className="settings-section-intro p-5">No adapters configured.</p>
        )}
      </SettingsPanel>
      <p className="settings-section-intro">
        Extension sources are managed in dsui.yaml. Restart DSUI after changing
        enabled plugins or their configuration.
      </p>
    </>
  );
}
