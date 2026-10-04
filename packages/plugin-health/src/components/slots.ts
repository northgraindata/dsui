/**
 * Host UI contributions, declared as slots.
 *
 * Each slot is a place DSUI's own chrome asks plugins to fill. Declaring them
 * with `defineSlot` keeps the render functions out of `plugin.ts`, so
 * `setup` reads as a list of registrations rather than a page of inline
 * rendering.
 */
import {
  defineSlot,
  type PluginContext,
  type PluginServiceSummary,
} from "@northgraindata/dsui-plugin-sdk";
import { serviceCardStatus } from "./status.js";

/** The plugin's own config, as the slots read it. */
type HealthConfig = {
  timeoutMs: number;
  maxServices: number;
};

type HealthContext = PluginContext<HealthConfig>;

/**
 * Trailing region of a dashboard service card.
 *
 * Renders nothing when the probe fails rather than a zero score: a card that
 * says "0/100" is a much stronger claim than "could not reach it".
 */
export const serviceCardSlot = defineSlot<HealthContext, PluginServiceSummary>({
  id: "service-card-status",
  slot: "dashboard.service-card.trailing",
  order: 50,
  render: async ({ context, service }) => {
    const probe = await context.services.probe(service.id, {
      timeoutMs: context.config.timeoutMs,
    });
    return probe ? serviceCardStatus({ ...service, ...probe }) : [];
  },
});
