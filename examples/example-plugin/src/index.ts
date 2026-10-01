import {
  Card,
  defineComponent,
  definePlugin,
  Grid,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";

const serviceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter: z.string(),
  managedBy: z.enum(["configuration", "ui"]),
});

const ServiceSummary = defineComponent<{ name: string; adapter: string }>({
  id: "example-plugin/service-summary",
  path: "./browser.mjs",
  props: z.object({ name: z.string(), adapter: z.string() }),
});

export default definePlugin({
  metadata: {
    id: "example-plugin",
    name: "Example plugin",
    version: "1.0.0",
    apiVersion: 1,
  },
  configSchema: z.object({
    greeting: z.string().default("Hello"),
  }),
  setup(registry) {
    registry.page({
      id: "overview",
      title: "Plugin example",
      description:
        "A trusted extension can add navigation and call the sanitized service catalog.",
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
    registry.navigation({
      id: "overview-link",
      area: "primary",
      label: "Plugin example",
      pageId: "overview",
      order: 100,
    });
    registry.slot({
      id: "service-card-status",
      slot: "dashboard.service-card.trailing",
      order: 100,
      render: ({ service }) =>
        ServiceSummary({ name: service.name, adapter: service.adapter }),
    });
    registry.slot({
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
    registry.procedure({
      id: "list-services",
      permission: "inspect",
      input: z.object({
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
      output: z.object({
        items: z.array(serviceSummarySchema),
        nextCursor: z.string().optional(),
      }),
      handler: (context, input) => context.services.list(input),
    });
    registry.procedure({
      id: "greet",
      permission: "inspect",
      input: z.object({ name: z.string().min(1) }),
      output: z.string(),
      handler: (context, input) => `${context.config.greeting}, ${input.name}`,
    });
  },
});
