import type * as ReactTypes from "react";
import type * as ReactDOMTypes from "react-dom";
import { AgentLauncher } from "./chat";
import { initializeReact } from "./react";
export function createComponents(
  react: typeof ReactTypes,
  reactDOM: typeof ReactDOMTypes,
) {
  initializeReact(react, reactDOM);
  return { "ai-agent/launcher": AgentLauncher };
}
