import type { SelectProps, UiKit } from "@northgraindata/dsui-ui/kit";
import { React } from "./react";

/**
 * Shared components come from the host: importing them would put a second copy
 * of React into this bundle. Only types may be imported, from `/kit`.
 */
let kit: UiKit;

export function initializeUi(ui: UiKit) {
  kit = ui;
}

export function Select(props: SelectProps) {
  return React.createElement(kit.Select, props);
}
