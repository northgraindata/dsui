import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import { accessHistory, accountDetails } from "../resources/admin.js";

export const accessHistoryPage = definePage({
  path: "/access-history",
  render: () => [
    PageHeader({ title: "Access history" }),
    Table({ source: accessHistory() }),
  ],
});

export const accountPage = definePage({
  path: "/account",
  render: () => [
    PageHeader({ title: "Account" }),
    KeyValue({ source: accountDetails() }),
  ],
});
