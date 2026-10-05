import type * as ReactTypes from "react";
import { initializeReact } from "./components/react";
import { RepositoryScreen } from "./components/screen";

export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return { "code-repository/screen": RepositoryScreen };
}
