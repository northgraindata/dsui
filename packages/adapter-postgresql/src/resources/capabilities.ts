import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLCapabilities } from "../client.js";
import type { PostgreSQLContext } from "../context.js";

export const capabilities = defineResource<
  PostgreSQLCapabilities,
  PostgreSQLContext
>({
  id: "capabilities",
  query: (_, ctx) => ctx.client.capabilities(),
});
