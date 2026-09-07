import {
  definePage,
  KeyValue,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import type { AccessRow } from "../context.js";
import { accessHistory, accountDetails } from "../resources/admin.js";

export const accessHistoryPage = definePage({
  path: "/access-history",
  render: () => [
    PageHeader({ title: "Access history" }),
    Table<AccessRow>({ source: accessHistory() }),
  ],
});

export const accountPage = definePage({
  path: "/account",
  render: () => [
    PageHeader({ title: "Account" }),
    KeyValue({ source: accountDetails() }),
  ],
});
