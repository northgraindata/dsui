import type { UiKit } from "@northgraindata/dsui-ui/kit";
import type * as ReactTypes from "react";
import { initializeUi } from "./components/host-ui";
import { initializeReact } from "./components/react";
import { RepositoryScreen } from "./components/screen";

export function createComponents(
  react: typeof ReactTypes,
  _reactDom: unknown,
  ui: UiKit,
) {
  initializeReact(react);
  initializeUi(ui);
  return { "code-repository/screen": RepositoryScreen };
}
