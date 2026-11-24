import type * as ReactTypes from "react";
import { IncidentHistory } from "./incident-history";
import { initializeReact } from "./react";
export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return { "monitoring/incident-history": IncidentHistory };
}
