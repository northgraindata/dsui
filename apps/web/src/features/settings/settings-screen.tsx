import type { SettingsSystem } from "@northgraindata/dsui-core";
import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { Button } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPluginCatalog, getSettingsSystem } from "../../api";
import { Icon } from "../../components/icon";
import { PageHeading, pageClass } from "../../components/page";
import { useSettings } from "./settings-context";
import { SettingsDrafts } from "./settings-drafts";
import { ExtensionSettings } from "./settings-extensions";
import { GeneralSettings, PreferenceSettings } from "./settings-forms";
import { settingsEntries } from "./settings-navigation";
import { SystemSettings } from "./settings-system";
import "./settings.css";

const sections = [
  { id: "general", label: "General", icon: "grid" },
  { id: "preferences", label: "Preferences", icon: "format" },
  { id: "extensions", label: "Extensions", icon: "plug", admin: true },
  { id: "system", label: "System", icon: "cpu", admin: true },
];
const emptyCatalog: PluginCatalog = {
  plugins: [],
  pages: [],
  navigation: [],
  slots: [],
};

export function SettingsScreen() {
  return (
    <SettingsDrafts>
      <SettingsContent />
    </SettingsDrafts>
  );
}

function SettingsContent() {
  const { snapshot, error, reload } = useSettings();
  const [section, setSection] = useState(
    () => window.location.hash.slice(1) || "general",
  );
  const [system, setSystem] = useState<SettingsSystem>();
  const [catalog, setCatalog] = useState<PluginCatalog>(emptyCatalog);
  const [extensionError, setExtensionError] = useState<string>();
  useEffect(() => {
    const change = () => setSection(window.location.hash.slice(1) || "general");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let active = true;
    getPluginCatalog()
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch(() => {
        if (active) setExtensionError("Could not load plugin settings.");
      });
    if (snapshot?.canManage)
      getSettingsSystem()
        .then((value) => {
          if (active) setSystem(value);
        })
        .catch(() => {
          if (active) setExtensionError("Could not load installation details.");
        });
    return () => {
      active = false;
    };
  }, [snapshot?.canManage]);
  if (!snapshot)
    return (
      <div className={pageClass}>
        <PageHeading title="Settings" />
        <p
          className={error ? "settings-error" : "text-muted"}
          role={error ? "alert" : "status"}
        >
          {error ?? "Loading settings…"}
        </p>
        {error && <Button onClick={reload}>Retry</Button>}
      </div>
    );
  const visible = sections.filter((item) => !item.admin || snapshot.canManage);
  const selected = visible.some((item) => item.id === section)
    ? section
    : "general";
  const entries = settingsEntries(catalog);
  const categories = [
    ...new Set(entries.map((entry) => entry.settings?.category ?? "Plugins")),
  ];
  return (
    <div className={pageClass}>
      <PageHeading
        title="Settings"
        detail="Make this workspace yours. Manage preferences, extensions and installation details."
        aside={
          <span
            className="settings-pill"
            data-environment={snapshot.installation.environment}
          >
            {snapshot.installation.environment}
          </span>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <span className="settings-nav-label">Workspace</span>
          {visible.map((item) => (
            <a
              href={`#${item.id}`}
              key={item.id}
              aria-current={selected === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </a>
          ))}
          {categories.map((category) => (
            <div key={category}>
              <div className="settings-nav-label">{category}</div>
              {entries
                .filter(
                  (entry) =>
                    (entry.settings?.category ?? "Plugins") === category,
                )
                .map((entry) => (
                  <Link
                    key={`${entry.pluginId}/${entry.id}`}
                    to="/plugins/$pluginId/$"
                    params={{ pluginId: entry.pluginId, _splat: entry.id }}
                  >
                    <Icon name="plug" size={15} />
                    {entry.settings?.label ?? entry.title}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="settings-content">
          <div className="settings-summary">
            <span className="settings-summary-mark">
              <Icon name="gear" size={20} />
            </span>
            <div>
              <strong>{snapshot.installation.name}</strong>
              <p>
                {snapshot.identity === "local"
                  ? "Local operator"
                  : "Your workspace"}{" "}
                ·{" "}
                {snapshot.canManage
                  ? "Administrator access"
                  : "Personal preferences"}
              </p>
            </div>
          </div>
          <div hidden={selected !== "general"}>
            <GeneralSettings key={snapshot.principalId} />
          </div>
          <div hidden={selected !== "preferences"}>
            <PreferenceSettings key={snapshot.principalId} />
          </div>
          {selected === "extensions" && system && (
            <ExtensionSettings system={system} catalog={catalog} />
          )}
          {selected === "system" && system && (
            <SystemSettings system={system} snapshot={snapshot} />
          )}
          {(selected === "extensions" || selected === "system") && !system && (
            <p
              className={
                extensionError ? "settings-error" : "settings-section-intro"
              }
              role={extensionError ? "alert" : "status"}
            >
              {extensionError ?? "Loading installation details…"}
            </p>
          )}
          {extensionError && selected === "general" && (
            <p className="settings-error" role="alert">
              {extensionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
