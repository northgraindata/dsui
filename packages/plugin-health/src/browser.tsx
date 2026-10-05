import type * as ReactTypes from "react";
import { HealthPage } from "./health-page";
import { initializeReact } from "./react";
export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return { "health/overview": HealthPage };
}
