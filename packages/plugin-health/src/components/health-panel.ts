import { Card, Grid } from "@northgraindata/dsui-plugin-sdk";
import { type ProbeResult, toneFor } from "../context.js";

/**
 * Service health panel used by the plugin page.
 *
 * Composed from shared primitives rather than plugin-specific components:
 * the presentation is expressible with existing nodes, so adding a custom
 * browser component here would add a bundle and a trust boundary without
 * buying anything.
 */
export function healthPanel(results: readonly ProbeResult[]) {
  if (results.length === 0)
    return Card({
      title: "No services configured",
      description: "Add a service to see its health here.",
    });
  return Grid({
    columns: 2,
    content: results.map((result) =>
      Card({
        title: result.name,
        description: result.detail ?? result.adapter,
        ...(result.latencyMs !== undefined
          ? { badge: `${result.latencyMs} ms` }
          : {}),
        badgeTone: toneFor(result.health),
        variant: "panel",
      }),
    ),
  });
}
