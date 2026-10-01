import { Card, Flex, Gauge } from "@northgraindata/dsui-plugin-sdk";
import type { ProbeResult } from "../context.js";
import { badgeTone, gaugeTone } from "../context.js";

/**
 * Service card contribution for `dashboard.service-card.trailing`.
 *
 * The card already shows the service name and adapter, so this renders the
 * score alone. Adding status text here would restate what the score encodes
 * and push the card's own content out of the available width; the detail
 * belongs on the workspace header and the health page, which have room for it.
 */
export function serviceCardStatus(probe: ProbeResult) {
  if (probe.score === undefined) {
    // No adapter reported a score. Rendering a zero ring would claim the
    // service scored zero, which is a different and much stronger claim.
    return Card({
      title: "Not scored",
      description: probe.adapter,
      variant: "subtle",
    });
  }
  return Gauge({
    value: probe.score,
    tone: gaugeTone(probe),
    label: `Health score ${Math.round(probe.score)} of 100`,
  });
}

/**
 * Workspace header contribution for `service.workspace.after-header`.
 *
 * The workspace has room for context, so the gauge is paired with the
 * adapter's own words about what is wrong and the measured latency.
 */
export function workspaceStatus(probe: ProbeResult) {
  const gauge =
    probe.score === undefined
      ? Card({
          title: "Health not scored",
          description: probe.adapter,
          variant: "subtle",
        })
      : Gauge({
          value: probe.score,
          tone: gaugeTone(probe),
          label: `Health score ${Math.round(probe.score)} of 100`,
        });
  return Flex({
    align: "center",
    gap: "md",
    content: [
      gauge,
      Card({
        title: probe.health,
        description:
          probe.latencyMs !== undefined
            ? `${probe.latencyMs} ms response time`
            : (probe.detail ?? probe.adapter),
        badgeTone: badgeTone(probe),
        variant: "subtle",
      }),
    ],
  });
}
