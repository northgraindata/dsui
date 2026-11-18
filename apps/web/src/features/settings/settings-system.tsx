import type {
  SettingsSnapshot,
  SettingsSystem,
} from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import { SettingsPanel, SettingsRow } from "./settings-fields";

export function SystemSettings({
  system,
  snapshot,
}: {
  system: SettingsSystem;
  snapshot: SettingsSnapshot;
}) {
  const exportDiagnostics = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              version: system.version,
              runtime: system.runtime,
              platform: system.platform,
              authentication: snapshot.identity,
              connectionEncryption: system.connectionEncryption,
              adapters: system.adapters,
              plugins: system.plugins,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "dsui-diagnostics.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <SettingsPanel
        title="Installation"
        description="Runtime information for this DSUI instance."
      >
        {[
          ["DSUI version", system.version],
          ["Runtime", system.runtime],
          ["Platform", system.platform],
          [
            "Authentication",
            snapshot.identity === "local"
              ? "Local operator"
              : "Provided by a plugin",
          ],
          ["Connection encryption", "Enabled"],
        ].map(([label, value]) => (
          <SettingsRow key={label} id={`system-${label}`} label={label}>
            <p className="settings-fact">{value}</p>
          </SettingsRow>
        ))}
      </SettingsPanel>
      <SettingsPanel
        title="Configuration & storage"
        description="Paths belong to the machine running DSUI."
      >
        <SettingsRow id="config-path" label="Configuration file">
          <code className="settings-fact">
            {system.configurationFile ?? "No configuration file supplied"}
          </code>
        </SettingsRow>
        <SettingsRow id="data-path" label="Data directory">
          <code className="settings-fact">{system.dataDirectory}</code>
        </SettingsRow>
      </SettingsPanel>
      <SettingsPanel
        title="Diagnostics"
        description="Download versions and extension status to help troubleshoot this installation. Credentials, configuration values and filesystem paths are excluded."
      >
        <div className="settings-form-footer">
          <Button variant="secondary" type="button" onClick={exportDiagnostics}>
            Download diagnostics
          </Button>
        </div>
      </SettingsPanel>
    </>
  );
}
