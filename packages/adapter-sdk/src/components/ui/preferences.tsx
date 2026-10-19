import { createContext, useContext } from "react";

/** Host-provided presentation preferences. Standalone renderers keep defaults. */
export type DisplayPreferences = {
  timeZone: string;
  clock: "24h" | "12h";
  density: "comfortable" | "compact";
  editorFontSize: number;
  editorWordWrap: boolean;
  editorTabSize: number;
};
export const defaultDisplayPreferences: DisplayPreferences = {
  timeZone: "browser",
  clock: "24h",
  density: "comfortable",
  editorFontSize: 13,
  editorWordWrap: false,
  editorTabSize: 2,
};
export const DisplayPreferencesContext = createContext<DisplayPreferences>(
  defaultDisplayPreferences,
);
export function useDisplayPreferences() {
  return useContext(DisplayPreferencesContext);
}

export function formatDisplayDate(
  value: string | number | Date,
  preferences: Pick<DisplayPreferences, "timeZone" | "clock">,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    ...(preferences.timeZone === "browser"
      ? {}
      : { timeZone: preferences.timeZone }),
    hour12: preferences.clock === "12h",
  });
}
