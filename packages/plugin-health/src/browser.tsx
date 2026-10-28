import type * as ReactTypes from "react";
import { initializeReact } from "./react";
import { IncidentPage, IncidentsPage } from "./ui/incidents";
import { OverviewPage } from "./ui/overview";
import { ServicePage } from "./ui/service";

export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return {
    "health/overview": OverviewPage,
    "health/service": ServicePage,
    "health/incidents": IncidentsPage,
    "health/incident": IncidentPage,
  };
}
