import {
  definePage,
  PageHeader,
  Section,
} from "@northgraindata/dsui-adapter-sdk";
import { Greeting, StatusCard } from "./components.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({ title: "Example" }),
    Section({
      title: "Status",
      content: StatusCard({ title: "Endpoint" }),
    }),
    Section({
      title: "Greeting",
      content: Greeting({ name: "DSUI", message: "from a browser component" }),
    }),
  ],
});
