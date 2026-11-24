import { Card, Gauge } from "@northgraindata/dsui-plugin-sdk";
import type { ProbeResult } from "../context.js";
import { gaugeTone } from "../context.js";

/**
 * Service card contribution for `dashboard.service-card.trailing`.
 *
 * The card shows the service identity and status, so the slot only shows
 * scoring information.
 */
export function serviceCardStatus(probe: ProbeResult) {
  if (probe.score === undefined) {
    // No adapter reported a score. Rendering a zero ring would claim the
    // service scored zero, which is a different and much stronger claim.
    return Card({
      title: "Not scored",
      variant: "subtle",
    });
  }
  return Gauge({
    value: probe.score,
    tone: gaugeTone(probe),
    label: `Health score ${Math.round(probe.score)} of 100`,
  });
}
