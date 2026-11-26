import type { UiKit } from "@northgraindata/dsui-ui/kit";
import type * as ReactTypes from "react";
import { HealthPage } from "./health-page";
import { initializeUi } from "./host-ui";
import { initializeReact } from "./react";

export function createComponents(
  react: typeof ReactTypes,
  _reactDom: unknown,
  ui: UiKit,
) {
  initializeReact(react);
  initializeUi(ui);
  return {
    "health/overview": HealthPage,
  };
}
