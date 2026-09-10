import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context";
import { extensionItems, extensionProfile } from "../extension-presentation";

export const extensionCatalog = defineResource({
  id: "extension-catalog",
  query: async (_: undefined, ctx: DuckDbContext) =>
    extensionItems(await ctx.client.listExtensions()),
});
// Explicitly allowlist non-secret settings. Never publish proxies or credentials.
const HTTP_SETTINGS = new Set([
  "http_timeout",
  "http_retries",
  "http_retry_wait_ms",
  "http_retry_backoff",
  "http_keep_alive",
  "http_max_connections",
  "enable_http_metadata_cache",
]);
export const extensionProfileResource = defineResource({
  id: "extension-profile",
  input: z.object({ name: z.string().min(1) }),
  query: async ({ name }, ctx: DuckDbContext) => {
    const extensions = await ctx.client.listExtensions();
    const extension = extensions.find((item) => item.name === name);
    if (!extension) throw new Error(`Extension not found: ${name}`);
    const settings =
      name === "httpfs" && extension.loaded
        ? (await ctx.client.listSettings("http")).filter((setting) =>
            HTTP_SETTINGS.has(setting.name),
          )
        : [];
    return extensionProfile(extension, extensions, settings);
  },
});
