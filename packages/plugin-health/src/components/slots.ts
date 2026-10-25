/**
 * Host UI contributions, declared as slots.
 *
 * Each slot is a place DSUI's own chrome asks plugins to fill. Declaring them
 * with `defineSlot` keeps the render functions out of `plugin.ts`, so
 * `setup` reads as a list of registrations rather than a page of inline
 * rendering.
 *
 * Slots only read recorded results. A dashboard with many cards must not
 * probe every service each time it renders.
 */
import {
  Card,
  defineSlot,
  type PluginContext,
  type PluginServiceSummary,
} from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "../config.js";
import { badgeTone, type ProbeResult } from "../context.js";
import { openHealthDb } from "../db.js";
import { activeIncident } from "../incidents.js";
import { readState } from "../repo.js";
import { rangeStats } from "../slo.js";
import { duration, percent } from "../ui/format.js";
import { serviceCardStatus } from "./status.js";

type HealthContext = PluginContext<HealthConfig>;

/**
 * Trailing region of a dashboard service card.
 *
 * Renders nothing before the first recorded check rather than a zero score: a
 * card that says "0/100" is a much stronger claim than "not checked yet".
 */
export const serviceCardSlot = defineSlot<HealthContext, PluginServiceSummary>({
  id: "service-card-status",
  slot: "dashboard.service-card.trailing",
  order: 50,
  render: ({ context, service }) => {
    const state = readState(openHealthDb(context.storage), service.id);
    if (!state) return [];
    const probe: ProbeResult = {
      id: service.id,
      name: service.name,
      adapter: service.adapter,
      managedBy: service.managedBy,
      health: state.health,
      ...(state.lastScore != null ? { score: state.lastScore } : {}),
      ...(state.lastLatencyMs != null
        ? { latencyMs: state.lastLatencyMs }
        : {}),
    };
    return serviceCardStatus(probe);
  },
});
