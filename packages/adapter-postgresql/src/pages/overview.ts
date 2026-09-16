import {
  definePage,
  KeyValue,
  PageHeader,
} from "@northgraindata/dsui-adapter-sdk";
import { capabilities } from "../resources/capabilities.js";
import { serverInfo } from "../resources/server.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "PostgreSQL",
      description: "Server connection and capability overview.",
    }),
    KeyValue({
      title: "Server",
      source: serverInfo(),
    }),
    KeyValue({
      title: "Capabilities",
      source: capabilities(),
    }),
  ],
});
