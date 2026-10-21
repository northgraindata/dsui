import { createContext, useContext, useEffect } from "react";

export const DraftsContext = createContext<
  (section: string, dirty: boolean) => void
>(() => {
  /* A page outside Settings has no draft registry. */
});

export function useSettingsDraft(section: string, dirty: boolean) {
  const report = useContext(DraftsContext);
  useEffect(() => {
    report(section, dirty);
    return () => report(section, false);
  }, [section, dirty, report]);
}
