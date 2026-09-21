import {
  Card,
  type CardNode,
  defineComponent,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { status } from "./resources.js";

/**
 * Server-side composite: `render` returns builtin nodes evaluated on the
 * server. No browser code is involved.
 */
export const StatusCard = defineComponent<{ title?: string }, CardNode>({
  id: "status-card",
  render: ({ title }) =>
    Card({
      title: title ?? "Endpoint",
      content: Value({ source: status(), field: "url" }),
    }),
});

/**
 * Browser component reference: `path` points at a `.tsx` module that is
 * bundled for the browser and lazy-loaded by the renderer. Props must be
 * JSON-serializable; nothing here crosses the server boundary.
 */
export const Greeting = defineComponent<{ name: string; message?: string }>({
  id: "example/greeting",
  path: "./components/greeting.tsx",
});
