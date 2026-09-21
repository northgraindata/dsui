import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLServerInfo } from "../client.js";
import type { PostgreSQLContext } from "../context.js";

export const serverInfo = defineResource<
  PostgreSQLServerInfo,
  PostgreSQLContext
>({
  id: "server-info",
  query: (_, ctx) => ctx.client.serverInfo(),
});
