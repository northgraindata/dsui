import { useBlocker } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";
import { DraftsContext } from "./settings-drafts-context";

export function SettingsDrafts({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  const report = useCallback(
    (section: string, dirty: boolean) =>
      setDrafts((previous) =>
        previous[section] === dirty
          ? previous
          : { ...previous, [section]: dirty },
      ),
    [],
  );
  const dirty = Object.values(drafts).some(Boolean);
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      current.pathname !== next.pathname &&
      dirty &&
      !window.confirm("Discard your unsaved settings changes?"),
    enableBeforeUnload: dirty,
    disabled: !dirty,
  });
  return (
    <DraftsContext.Provider value={report}>{children}</DraftsContext.Provider>
  );
}
