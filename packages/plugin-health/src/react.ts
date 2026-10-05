import type * as ReactTypes from "react";

export let React: typeof ReactTypes;
export function initializeReact(react: typeof ReactTypes) {
  React = react;
}
