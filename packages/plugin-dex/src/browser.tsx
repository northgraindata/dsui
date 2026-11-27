import type * as ReactTypes from "react";
import { initializeReact } from "./ui/react";
import { DexScreen } from "./ui/screen";

export function createComponents(react: typeof ReactTypes) {
  initializeReact(react);
  return { "dex/screen": DexScreen };
}
