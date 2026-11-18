import {
  DisplayPreferencesContext,
  defaultDisplayPreferences,
} from "@northgraindata/dsui-adapter-sdk/components/ui/preferences";
import type { SettingsSnapshot } from "@northgraindata/dsui-core";
import { useRouterState } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSettings } from "../../api";
import { SettingsContext } from "./settings-context";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>();
  const generation = useRef(0);
  const update = useCallback((value: SettingsSnapshot) => {
    generation.current++;
    setSnapshot(value);
  }, []);
  const [error, setError] = useState<string>();
  const reload = useCallback(() => {
    let active = true;
    const request = ++generation.current;
    getSettings()
      .then((value) => {
        if (active && request === generation.current) {
          setSnapshot(value);
          setError(undefined);
        }
      })
      .catch((cause) => {
        if (active && request === generation.current) {
          setSnapshot(undefined);
          setError(
            cause instanceof Error ? cause.message : "Could not load settings",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (pathname) return reload();
  }, [reload, pathname]);
  const preferences = snapshot && {
    ...snapshot.preferences,
    timeZone:
      snapshot.preferences.timeZone === "inherit"
        ? snapshot.installation.timeZone
        : snapshot.preferences.timeZone,
  };
  useEffect(() => {
    document.documentElement.dataset.density =
      snapshot?.preferences.density ?? "comfortable";
    document.title = snapshot
      ? `${snapshot.installation.name} · DSUI`
      : "DSUI — Data Stack UI";
  }, [snapshot]);
  return (
    <SettingsContext.Provider value={{ snapshot, error, update, reload }}>
      <DisplayPreferencesContext.Provider
        value={preferences ?? defaultDisplayPreferences}
      >
        {children}
      </DisplayPreferencesContext.Provider>
    </SettingsContext.Provider>
  );
}
