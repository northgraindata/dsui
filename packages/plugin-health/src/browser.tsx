import type * as ReactTypes from "react";
import { initializeReact } from "./react";
import { OverviewPage } from "./ui/overview";
import { ServicePage } from "./ui/service";
import { StatusPagesPage, StatusPageView } from "./ui/status-pages";

export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return {
    "health/overview": OverviewPage,
    "health/service": ServicePage,
    "health/status-pages": StatusPagesPage,
    "health/status-page": StatusPageView,
  };
}
