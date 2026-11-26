/** A plugin that receives components from the host and bundles none. */
import type * as ReactTypes from "react";
import type { Select } from "../select";

export function createComponents(
  react: typeof ReactTypes,
  _reactDom: unknown,
  ui: { Select: typeof Select },
) {
  return {
    "spike/picker": () =>
      react.createElement(ui.Select, {
        ariaLabel: "Plugin picker (hosted)",
        options: [{ value: "a", label: "Alpha" }],
      }),
  };
}
