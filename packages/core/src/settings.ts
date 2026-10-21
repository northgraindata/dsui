/** Non-secret settings shared by the host and browser. */
export type InstallationSettings = {
  name: string;
  environment: "local" | "development" | "staging" | "production";
  timeZone: string;
};
export type UserPreferences = {
  timeZone: string;
  clock: "24h" | "12h";
  density: "comfortable" | "compact";
  editorFontSize: number;
  editorWordWrap: boolean;
  editorTabSize: number;
};
export const installationDefaults: InstallationSettings = {
  name: "My workspace",
  environment: "local",
  timeZone: "browser",
};
export const preferenceDefaults: UserPreferences = {
  timeZone: "inherit",
  clock: "24h",
  density: "comfortable",
  editorFontSize: 13,
  editorWordWrap: false,
  editorTabSize: 2,
};
export type SettingsSnapshot = {
  principalId: string;
  installation: InstallationSettings;
  managed: (keyof InstallationSettings)[];
  preferences: UserPreferences;
  revision: { installation: number; preferences: number };
  canManage: boolean;
  identity: "local" | "authenticated";
};
export type SettingsSystem = {
  version: string;
  runtime: string;
  platform: string;
  dataDirectory: string;
  configurationFile: string | null;
  connectionEncryption: "enabled";
  adapters: {
    iconUrl?: string;
    id: string;
    name: string;
    status: "ready" | "unavailable";
    source: string;
  }[];
  plugins: {
    id: string;
    name: string;
    version: string;
    status: "ready" | "disabled" | "unavailable";
    source: string;
  }[];
};
