/**
 * The example plugin's own contributions.
 *
 * Declared with the same `defineX` family an adapter uses, so a plugin reads
 * like an adapter to anyone who has written one.
 */
import {
  Card,
  definePage,
  defineSlot,
  Grid,
  type PluginContext,
  type PluginServiceSummary,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { ServiceSummary } from "./service-summary.js";

/** The plugin's own config, as the page reads it. */
type ExampleConfig = { greeting: string };

/**
 * The plugin's overview page.
 *
 * Reads the sanitized service catalog the host exposes, which lists services
 * without their credentials.
 */
export const overviewPage = definePage<
  "/example",
  PluginContext<ExampleConfig>
>({
  path: "/example",
  render: async ({ context }) => {
    const { items } = await context.services.list({ limit: 12 });
    return [
      Section({
        title: "Connected services",
        content:
          items.length > 0
            ? Grid({
                columns: 2,
                content: items.map((service) =>
                  Card({
                    title: service.name,
                    description: service.adapter,
                    variant: "panel",
                    content: ServiceSummary({
                      name: service.name,
                      adapter: service.adapter,
                    }),
                  }),
                ),
              })
            : Card({
                title: "No services configured",
                description: "Add a service to see it listed here.",
              }),
      }),
    ];
  },
});

/** Trailing region of a dashboard service card. */
export const serviceCardSlot = defineSlot<
  PluginContext<ExampleConfig>,
  PluginServiceSummary
>({
  id: "service-card-status",
  slot: "dashboard.service-card.trailing",
  order: 100,
  render: ({ service }) =>
    ServiceSummary({ name: service.name, adapter: service.adapter }),
});

/** Footer of a service workspace header. */
export const workspaceSummarySlot = defineSlot<
  PluginContext<ExampleConfig>,
  PluginServiceSummary
>({
  id: "workspace-summary",
  slot: "service.workspace.after-header",
  order: 100,
  render: ({ service }) =>
    Card({
      title: "Plugin extension",
      content: ServiceSummary({
        name: service.name,
        adapter: service.adapter,
      }),
    }),
});
