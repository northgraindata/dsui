import type * as ReactTypes from "react";
import { initializeReact } from "./react";
import { StatusPagesPage, StatusPageView } from "./ui/status-pages";
export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return {
    "status-pages/overview": StatusPagesPage,
    "status-pages/page": StatusPageView,
  };
}
