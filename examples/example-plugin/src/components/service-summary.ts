/**
 * The plugin's one custom browser component.
 *
 * Declared with `defineComponent` and a `path`, so the host loads the
 * implementation from this package's browser bundle. The id is namespaced by
 * the plugin, which is what keeps two plugins from claiming the same component.
 */
import { defineComponent, z } from "@northgraindata/dsui-plugin-sdk";

export const ServiceSummary = defineComponent<{
  name: string;
  adapter: string;
}>({
  id: "example-plugin/service-summary",
  path: "./browser.mjs",
  props: z.object({ name: z.string(), adapter: z.string() }),
});
