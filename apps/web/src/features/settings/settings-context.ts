import type { SettingsSnapshot } from "@northgraindata/dsui-core";
import { createContext, useContext } from "react";

export const SettingsContext = createContext<{
  snapshot?: SettingsSnapshot;
  error?: string;
  update(snapshot: SettingsSnapshot): void;
  reload(): void;
}>({
  update: () => {
    /* Provider owns updates. */
  },
  reload: () => {
    /* Provider owns requests. */
  },
});

export function useSettings() {
  return useContext(SettingsContext);
}
