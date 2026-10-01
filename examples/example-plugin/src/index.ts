import { definePlugin } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import {
  overviewPage,
  serviceCardSlot,
  workspaceSummarySlot,
} from "./components/contributions.js";

const serviceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter: z.string(),
  managedBy: z.enum(["configuration", "ui"]),
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
    registry.page(overviewPage, {
      id: "overview",
      title: "Plugin example",
      description:
        "A trusted extension can add navigation and call the sanitized service catalog.",
    });
    registry.navigation({
      id: "overview-link",
      area: "primary",
      label: "Plugin example",
      pageId: "overview",
      order: 100,
    });
    registry.slot(serviceCardSlot);
    registry.slot(workspaceSummarySlot);
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
