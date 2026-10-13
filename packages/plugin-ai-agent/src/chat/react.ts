import type * as ReactTypes from "react";
import type * as ReactDOMTypes from "react-dom";
export let React: typeof ReactTypes;
export let ReactDOM: typeof ReactDOMTypes;
export function initializeReact(
  react: typeof ReactTypes,
  reactDOM: typeof ReactDOMTypes,
) {
  React = react;
  ReactDOM = reactDOM;
}
