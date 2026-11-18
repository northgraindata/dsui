import type * as ReactTypes from "react";
import { HealthPage } from "./health-page";
import { initializeReact } from "./react";
import { StatusPagesPage, StatusPageView } from "./ui/status-pages";

export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return {
    "health/overview": HealthPage,
    "health/status-pages": StatusPagesPage,
    "health/status-page": StatusPageView,
  };
}
