import { createContext, useContext } from "react";

/**
 * The top bar element that a workspace renders its tabs into, so tabs can
 * sit in the shell's header while their state stays with the workspace.
 */
export const TopbarTabsSlot = createContext<HTMLElement | null>(null);

export function useTopbarTabsSlot(): HTMLElement | null {
  return useContext(TopbarTabsSlot);
}
