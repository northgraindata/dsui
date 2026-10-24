import { createContext, type ReactNode, useContext, useReducer } from "react";
import {
  type AdapterTabsAction,
  type AdapterTabsState,
  adapterTabsReducer,
  initialAdapterTabsState,
} from "./adapter-tabs-state";

const AdapterTabsContext = createContext<{
  state: AdapterTabsState;
  dispatch: (action: AdapterTabsAction) => void;
} | null>(null);

export function AdapterTabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    adapterTabsReducer,
    initialAdapterTabsState,
  );
  return (
    <AdapterTabsContext.Provider value={{ state, dispatch }}>
      {children}
    </AdapterTabsContext.Provider>
  );
}

export function useAdapterTabs() {
  const context = useContext(AdapterTabsContext);
  if (!context) throw new Error("Adapter tabs require AdapterTabsProvider");
  return context;
}
