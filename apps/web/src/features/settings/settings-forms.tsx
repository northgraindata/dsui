import { formatDisplayDate } from "@northgraindata/dsui-adapter-sdk/components/ui/preferences";
import {
  type InstallationSettings,
  preferenceDefaults,
  type UserPreferences,
} from "@northgraindata/dsui-core";
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { saveSettings } from "../../api";
import { useSettings } from "./settings-context";
import { useSettingsDraft } from "./settings-drafts-context";
import { SettingsPanel, SettingsRow, TimeZoneInput } from "./settings-fields";

function useSave(scope: "installation" | "preferences") {
  const { snapshot, update } = useSettings();
  const [revision, setRevision] = useState(snapshot?.revision[scope] ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  return {
    saving,
    error,
    saved,
    reset: () => {
      setRevision(snapshot?.revision[scope] ?? 0);
      setError(undefined);
      setSaved(false);
    },
    save: async (value: InstallationSettings | UserPreferences) => {
      if (!snapshot) return;
      setSaving(true);
      setSaved(false);
      setError(undefined);
      try {
        const result = await saveSettings(scope, revision, value);
        update(result);
        setRevision(result.revision[scope]);
        setSaved(true);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not save settings",
        );
      } finally {
        setSaving(false);
      }
    },
  };
}

export function GeneralSettings() {
  const { snapshot } = useSettings();
  const [draft, setDraft] = useState(snapshot?.installation);
  const state = useSave("installation");
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(snapshot?.installation);
  useSettingsDraft("general", dirty);
  if (!snapshot || !draft) return null;
  const disabled = (key: keyof InstallationSettings) =>
    !snapshot.canManage || snapshot.managed.includes(key) || state.saving;
  const source = (key: keyof InstallationSettings) =>
    snapshot.managed.includes(key)
      ? `Managed by dsui.yaml · settings.${key}`
      : "Installation default · applies to everyone";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void state.save(draft);
      }}
    >
      <SettingsPanel
        title="Workspace details"
        description="Give this installation a name and make its environment easy to recognize."
      >
        <SettingsRow
          id="workspace-name"
          label="Workspace name"
          description="Shown in the sidebar and browser tab."
          source={source("name")}
        >
          <input
            id="workspace-name"
            value={draft.name}
            maxLength={80}
            required
            disabled={disabled("name")}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </SettingsRow>
        <SettingsRow
          id="workspace-environment"
          label="Environment"
          description="A visible label to help distinguish production from development."
          source={source("environment")}
        >
          <select
            id="workspace-environment"
            value={draft.environment}
            disabled={disabled("environment")}
            onChange={(event) =>
              setDraft({
                ...draft,
                environment: event.target
                  .value as InstallationSettings["environment"],
              })
            }
          >
            {["local", "development", "staging", "production"].map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow
          id="workspace-timezone"
          label="Default time zone"
          description="Choose a shared time zone or follow each person's device."
          source={source("timeZone")}
        >
          <TimeZoneInput
            id="workspace-timezone"
            value={draft.timeZone}
            onChange={(timeZone) => setDraft({ ...draft, timeZone })}
            disabled={disabled("timeZone")}
          />
        </SettingsRow>
        {snapshot.canManage && (
          <div className="settings-form-footer">
            {state.error && (
              <p className="settings-error" role="alert">
                {state.error}
              </p>
            )}
            <span role="status">
              {state.saved && !dirty ? "Changes saved" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={!dirty || state.saving}
              onClick={() => {
                setDraft(snapshot.installation);
                state.reset();
              }}
            >
              Discard
            </Button>
            <Button type="submit" disabled={!dirty || state.saving}>
              {state.saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </SettingsPanel>
    </form>
  );
}

export function PreferenceSettings() {
  const { snapshot } = useSettings();
  const [draft, setDraft] = useState(snapshot?.preferences);
  const state = useSave("preferences");
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot?.preferences);
  useSettingsDraft("preferences", dirty);
  if (!snapshot || !draft) return null;
  const timeZone =
    draft.timeZone === "inherit"
      ? snapshot.installation.timeZone
      : draft.timeZone;
  let preview: string;
  try {
    preview = formatDisplayDate(new Date(), { timeZone, clock: draft.clock });
  } catch {
    preview = "Choose a valid time zone";
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void state.save(draft);
      }}
      className="settings-content"
    >
      <SettingsPanel
        title="Your preferences"
        description={
          snapshot.identity === "local"
            ? "Saved for this installation's local operator."
            : "Saved to your account. Other people's preferences stay unchanged."
        }
      >
        <SettingsRow
          id="personal-timezone"
          label="Time zone"
          description="Follow the workspace default or choose your own time zone."
        >
          <TimeZoneInput
            id="personal-timezone"
            value={draft.timeZone}
            onChange={(value) => setDraft({ ...draft, timeZone: value })}
            inherit
            disabled={state.saving}
          />
        </SettingsRow>
        <SettingsRow id="personal-clock" label="Clock" description={preview}>
          <select
            id="personal-clock"
            value={draft.clock}
            disabled={state.saving}
            onChange={(event) =>
              setDraft({
                ...draft,
                clock: event.target.value as UserPreferences["clock"],
              })
            }
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </SettingsRow>
        <SettingsRow
          id="personal-density"
          label="Table density"
          description="Spacing in shared data tables across adapters."
        >
          <select
            id="personal-density"
            value={draft.density}
            disabled={state.saving}
            onChange={(event) =>
              setDraft({
                ...draft,
                density: event.target.value as UserPreferences["density"],
              })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </SettingsRow>
      </SettingsPanel>
      <SettingsPanel
        title="SQL editor"
        description="Shared by adapters using the DSUI SQL editor."
      >
        <SettingsRow
          id="editor-font"
          label="Font size"
          description="Choose between 11 and 20 pixels."
        >
          <select
            id="editor-font"
            value={draft.editorFontSize}
            disabled={state.saving}
            onChange={(event) =>
              setDraft({ ...draft, editorFontSize: Number(event.target.value) })
            }
          >
            {Array.from({ length: 10 }, (_, index) => index + 11).map(
              (size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ),
            )}
          </select>
        </SettingsRow>
        <SettingsRow id="editor-tabs" label="Tab size">
          <select
            id="editor-tabs"
            value={draft.editorTabSize}
            disabled={state.saving}
            onChange={(event) =>
              setDraft({ ...draft, editorTabSize: Number(event.target.value) })
            }
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
          </select>
        </SettingsRow>
        <SettingsRow
          id="editor-wrap"
          label="Wrap long lines"
          description="Keep long SQL statements inside the editor."
        >
          <input
            id="editor-wrap"
            type="checkbox"
            checked={draft.editorWordWrap}
            disabled={state.saving}
            onChange={(event) =>
              setDraft({ ...draft, editorWordWrap: event.target.checked })
            }
          />
        </SettingsRow>
        <div className="settings-preview">
          <span className="settings-source">Editor preview</span>
          <code
            style={{
              fontSize: draft.editorFontSize,
              tabSize: draft.editorTabSize,
            }}
          >
            SELECT name, created_at{"\n"}FROM analytics.events{"\n"}WHERE status
            = 'active';
          </code>
        </div>
        <div className="settings-form-footer">
          {state.error && (
            <p role="alert" className="settings-error">
              {state.error}
            </p>
          )}
          <span role="status">
            {state.saved && !dirty ? "Preferences saved" : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={state.saving}
            onClick={() => setDraft({ ...preferenceDefaults })}
          >
            Reset defaults
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || state.saving}
            onClick={() => {
              setDraft(snapshot.preferences);
              state.reset();
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!dirty || state.saving}>
            {state.saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </SettingsPanel>
    </form>
  );
}
