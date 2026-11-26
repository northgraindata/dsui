/** A plugin that imports the Radix component, as any library would be used. */
import type * as ReactTypes from "react";
import { Select } from "../select";

export function createComponents(react: typeof ReactTypes) {
  return {
    "spike/picker": () =>
      react.createElement(Select, {
        ariaLabel: "Plugin picker (bundled)",
        options: [{ value: "a", label: "Alpha" }],
      }),
  };
}
