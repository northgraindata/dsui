import type * as ReactTypes from "react";

/** The host's React, handed to the bundle so only one copy is ever loaded. */
export let React: typeof ReactTypes;
export function initializeReact(react: typeof ReactTypes) {
  React = react;
}
